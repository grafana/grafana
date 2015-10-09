library Tools;

uses
  System.SysUtils, System.Classes, WinApi.Windows, Winapi.WinSock, WinApi.IpHlpApi, WinApi.IpRtrMib, uPackets,
  uJSONClient;

{$R *.res}

Type

TNetCrunchConnection = class(TJSONClient)
private
  FURL : String;
  FUser : String;
  FPassword : String;

  function GetPropertyValue(AJSONObject: TVariantArray; const APropertyName: String) : String;
public
  constructor Create(const AURL, AUser, APassword: String);
  function GetApi(var AApi : TVariantArray) : Boolean;
  function GetApiName(AApi : TVariantArray) : String;
  function GetApiVer(AApi : TVariantArray; var AVer, AMajor, AMinor, ABuild : Integer) : Boolean;
end;

function CheckInteger (const StringNumber : String; var Number : Integer) : Boolean;
begin
  try
    Number := StrToInt(StringNumber);
    Result := True;
  except
    Result := False;
  end;
end;

function ParseVersion(const AVersion : String; var AVer, AMajor, AMinor, ABuild : Integer) : Boolean;
var
  VersionStrings: TStrings;

begin
  AVer := 0;
  AMajor := 0;
  AMinor := 0;
  ABuild := 0;

  if (AVersion <> '') then begin
    VersionStrings := TStringList.Create;
    try
      Result := False;
      ExtractStrings(['.'],[], PChar(AVersion), VersionStrings);
      if (VersionStrings.Count >= 3) then begin
        if (CheckInteger(VersionStrings[0], AVer) and CheckInteger(VersionStrings[1], AMajor) and
            CheckInteger(VersionStrings[2], AMinor)) then begin
          if VersionStrings.Count > 3 then CheckInteger(VersionStrings[3], ABuild);
          Result := True;
        end;
      end;
    finally
      VersionStrings.Free;
    end;
  end else begin
    Result := False;
  end;
end;

function CompareVersion (AVer1, AVer2 : PAnsiChar) : Integer; stdcall;

var
  Ver1, Major1, Minor1, Build1 : Integer;
  Ver2, Major2, Minor2, Build2 : Integer;
  CompareResult : Integer;

  function CompareNumbers(ANumber1, ANumber2 : Integer) : Integer;
  begin
    if (ANumber1 < ANumber2) then begin
      Result := -1;
    end else begin
      if (ANumber1 > ANumber2) then begin
        Result := 1;
      end else begin
        Result := 0;
      end;
    end;
  end;

begin
  CompareResult := 2;
  if ((ParseVersion(String(AVer1), Ver1, Major1, Minor1, Build1) and
       ParseVersion(String(AVer2), Ver2, Major2, Minor2, Build2))) then begin
    CompareResult := CompareNumbers(Ver1, Ver2);
    if (CompareResult = 0) then begin
      CompareResult := CompareNumbers(Major1, Major2);
      if CompareResult = 0 then begin
        CompareResult := CompareNumbers(Minor1, Minor2);
        if CompareResult = 0 then begin
          CompareResult := CompareNumbers(Build1, Build2);
        end;
      end;
    end;
  end;
  Result := CompareResult;
end;

function TNetCrunchConnection.GetPropertyValue(AJSONObject: TVariantArray; const APropertyName: String) : String;
var
  V: Variant;
  Value: String;

begin
  for V in AJSONObject do begin
    Value := VarAsPacket(V).GetProperty(APropertyName, '');
    if Value <> '' then Exit(Value);
  end;
  Result := '';
end;

constructor TNetCrunchConnection.Create(const AURL, AUser, APassword: String);
begin
  inherited Create;
  FURL := AURL;
  FUser := AUser;
  FPassword := APassword;
end;

function TNetCrunchConnection.GetApi(var AApi : TVariantArray) : Boolean;
var QueryResult : TJSONClientResponse;
begin
  QueryResult := DoGet(FURL + '/ncapi/api.json');
  if (QueryResult.IsValidStatus and (QueryResult.Status = 200)) then begin
    AApi := VarAsArray(QueryResult.Data.Properties['api']);
    Result := true;
  end else begin
    Result := false;
  end;
end;

function TNetCrunchConnection.GetApiName (AApi : TVariantArray) : String;
begin
  Result := GetPropertyValue(AApi, 'name');
end;

function TNetCrunchConnection.GetApiVer(AApi : TVariantArray; var AVer, AMajor, AMinor, ABuild : Integer) : Boolean;
var Version : String;
begin
  Version := GetPropertyValue(AApi, 'ver');
  Result := ParseVersion(Version, AVer, AMajor, AMinor, ABuild);
end;

procedure GetIPAddress(var HostName, IP: String);

type
  pu_long = ^u_long;

var
  TWSADataBuffer : TWSAData;
  NameBuffer : Array[0..255] of AnsiChar;
  PHostEntBuffer : PHostEnt;
  TInAddrBuffer : TInAddr;

begin
  HostName := '';
  IP := '';

  if (WSAStartup($101, TWSADataBuffer) = 0) then begin
    gethostname(NameBuffer, sizeof(NameBuffer));
    PHostEntBuffer := gethostbyname(NameBuffer);
    HostName := String(PHostEntBuffer^.h_name);
    TInAddrBuffer.S_addr := u_long(pu_long(PHostEntBuffer^.h_addr_list^)^);
    IP := String(inet_ntoa(TInAddrBuffer));
  end;
  WSACleanup;
end;

function IsPortRestricted(APort: Integer): Boolean;
const
  RESTRICTED_PORTS = [1, 79];
begin
  Result := APort in RESTRICTED_PORTS;
end;

function IsPortAvailable(APort: Integer): Boolean;
var
  ErrorCode, TableSize: DWORD;
  Table: PMIB_TCPTABLE;
  i: Integer;

begin
  Result := True;
  TableSize := 0;
  Table := nil;

  if GetTcpTable(Table, TableSize, True) = ERROR_INSUFFICIENT_BUFFER then begin
    GetMem(Table, TableSize);

    try
      ErrorCode := GetTcpTable(Table, TableSize, True);
      if (ErrorCode = 0) then begin
        for i := 0 to Table.dwNumEntries - 1 do
          if (Table.table[i].dwState = MIB_TCP_STATE_LISTEN) and (ntohs(Table.table[i].dwLocalPort) = APort) then
            Exit(False);
      end;
    finally
      FreeMem(Table);
    end;
  end;
end;

function GetHostName : PAnsiChar; stdcall;
var
  Name: String;
  IP: String;
  HostName: String;

begin
  GetIPAddress(Name, IP);
  if (AnsiPos('.', Name) = 0)
    then HostName := IP
    else HostName := Name;
  Result := PAnsiChar(AnsiString(HostName));
end;

function CheckServerPort (APort : PAnsiChar) : Integer; stdcall;
var
  Port : Integer;
  CheckCode : Integer;

begin
  if CheckInteger(String(APort), Port) then begin
    if (Port > 0) then begin
      if IsPortRestricted(Port) then begin
        CheckCode := 2;
      end else begin
        if IsPortAvailable(Port)
          then CheckCode := 0
          else CheckCode := 3;
      end;
    end else begin
      CheckCode := 4;
    end;
  end else begin
    CheckCode := 1;
  end;

  Result := CheckCode;
end;

function CheckNetCrunchServerConnection (AServerURL, AUser, APassword: PAnsiChar) : Integer; stdcall;
var
  NetCrunchServerConnection : TNetCrunchConnection;
  CheckCode : Integer;
  Api : TVariantArray;
  Version, Major, Minor, Build : Integer;

begin
  NetCrunchServerConnection := TNetCrunchConnection.Create(String(AnsiString(AServerURL)), String(AnsiString(AUser)),
                                                           String(AnsiString(APassword)));
  try
    CheckCode := 3;
    if NetCrunchServerConnection.GetApi(Api) then begin
      if NetCrunchServerConnection.GetApiName(Api) = 'ncSrv' then begin
        if NetCrunchServerConnection.GetApiVer(Api, Version, Major, Minor, Build) then begin
          if (Version >= 9)
            then CheckCode := 0
            else CheckCode := 2;
        end else begin
          CheckCode := 2;
        end;
      end else begin
        CheckCode := 4;
      end;
    end else begin
      CheckCode := 1;
    end;
  finally
    NetCrunchServerConnection.Free;
  end;
  Result := CheckCode;
end;

exports
  CompareVersion,
  GetHostName,
  CheckServerPort,
  CheckNetCrunchServerConnection;
end.

