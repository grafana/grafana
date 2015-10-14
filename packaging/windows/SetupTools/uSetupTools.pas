{****************************************************************
 *
 * Author : Boguslaw Gorczyca
 * Created: 2015-10-09
 *
 * No part of this file may be duplicated, revised, translated,
 * localized or modified in any manner or compiled, linked or
 * uploaded or downloaded to or from any computer system without
 * the prior written consent of AdRem Software sp z o.o.
 *
 * 2015 Copyright AdRem Software, all rights reserved
 ****************************************************************}

unit uSetupTools;

interface

  uses uPackets, uJSONClient, uNetCrunchClient, uClientIntf;

  Type

  TNetCrunchWebAppConnection = class(TJSONClient)
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

  TNetCrunchServerConnection = class
  private
    FNetCrunchClient : INCClient;
    FUsername : String;
    FPassword : String;
    FToken : String;
    FLoginCode : Integer;
    procedure Authenticate (Sender: TObject; out Authenticated: Boolean);
  public
    constructor Create (const AAddress, APort, APassword : String);
    procedure Connect;
    function IsReady : Boolean;
    function IsAuthenticated : Boolean;
    function GetConnectionStatus : Integer;
    function GetServerVersion : String;
    function GetGrafCrunchUserPass : String;
    procedure GetWebAppServerConfig (out Port : Integer; out SSL : Boolean);
    procedure Close;
    destructor Destroy; override;
  end;

  function CheckInteger (const StringNumber : String; var Number : Integer) : Boolean;
  function ParseVersion(const AVersion : String; var AVer, AMajor, AMinor, ABuild : Integer) : Boolean;
  function CompareVersion (AVer1, AVer2 : PAnsiChar) : Integer; stdcall;
  procedure GetIPAddress(var HostName, IP: String);
  function IsPortRestricted(APort: Integer): Boolean;
  function IsPortAvailable(APort: Integer): Boolean;
  function GetHostName : PAnsiChar; stdcall;
  function CheckServerPort (APort : PAnsiChar) : Integer; stdcall;
  function CheckNetCrunchWebAppServerConnection (AServerURL, AUser, APassword: PAnsiChar) : Integer; stdcall;
  function ReadNetCrunchServerConfig(AAddress, APort, APassword: PAnsiChar) : PAnsiChar; stdcall;

implementation

uses System.SysUtils, System.Classes, WinApi.Windows, Winapi.WinSock, WinApi.IpHlpApi, WinApi.IpRtrMib,
     uNCAuthorityConsts, uNCSharedConsts, uRemoteUserProfilesManagerClient, uUserProfilesManagerIntf,
     uNcMonitorConfigClient, uNcMonitorIntf, uWAOptionsEditor;

const
  MIN_NETCRUNCH_SERVER_VERSION = '9.0.0.0';
  NC_WRONG_SERVER_VERSION = 10;
  HOST_ADDRESS_RESOLVE_ERROR = 11;

function TNetCrunchWebAppConnection.GetPropertyValue(AJSONObject: TVariantArray; const APropertyName: String) : String;
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

constructor TNetCrunchWebAppConnection.Create(const AURL, AUser, APassword: String);
begin
  inherited Create;
  FURL := AURL;
  FUser := AUser;
  FPassword := APassword;
end;

function TNetCrunchWebAppConnection.GetApi(var AApi : TVariantArray) : Boolean;
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

function TNetCrunchWebAppConnection.GetApiName (AApi : TVariantArray) : String;
begin
  Result := GetPropertyValue(AApi, 'name');
end;

function TNetCrunchWebAppConnection.GetApiVer(AApi : TVariantArray; var AVer, AMajor, AMinor, ABuild : Integer) : Boolean;
var Version : String;
begin
  Version := GetPropertyValue(AApi, 'ver');
  Result := ParseVersion(Version, AVer, AMajor, AMinor, ABuild);
end;

constructor TNetCrunchServerConnection.Create (const AAddress, APort, APassword : String);
begin
  inherited Create;
  FLoginCode := -1;
  try
    FNetCrunchClient := InitNetCrunchClient(AAddress, APort, 0, False) as INCClient;
    FUsername := CONSOLE_NETCRUNCH_USER;
    FPassword := APassword;
  except
    FNetCrunchClient := Nil;
    FUsername := '';
    FPassword := '';
  end;
end;

procedure TNetCrunchServerConnection.Authenticate (Sender: TObject; out Authenticated: Boolean);
begin
  FLoginCode := FNetCrunchClient.Login(FUsername, FPassword, FToken);
  Authenticated := (FLogincode = NC_AUTHENTICATE_OK);
end;

procedure TNetCrunchServerConnection.Connect;
begin
  if IsReady then begin
    FNetCrunchClient.OnAuthenticateNeeded := Authenticate;
    FNetCrunchClient.AutoReconnect := True;
    FNetCrunchClient.Open;
  end;
end;

function TNetCrunchServerConnection.IsReady : Boolean;
begin
  Result := Assigned(FNetCrunchClient);
end;

function TNetCrunchServerConnection.IsAuthenticated : Boolean;
begin
  Result := IsReady and FNetCrunchClient.IsAuthenticated;
end;

function TNetCrunchServerConnection.GetConnectionStatus : Integer;
begin
  Result := FLoginCode;
end;

function TNetCrunchServerConnection.GetServerVersion : String;
begin
  if IsReady then begin
    Result := FNetCrunchClient.GetServerInfo.GetAsPacket.Properties['Version'];
  end else begin
    Result := '';
  end;
end;

function TNetCrunchServerConnection.GetGrafCrunchUserPass : String;
var
  UserProfilesManager : IUserProfilesManager;
  Password : String;
begin
  UserProfilesManager := CreateRemoteUserProfilesManagerClient(FNetCrunchClient);
  Password := '';
  try
    UserProfilesManager.CreateGrafCrunchUser(Password);
  finally
    UserProfilesManager := NIL;
  end;
  Result := Password;
end;

procedure TNetCrunchServerConnection.GetWebAppServerConfig (out Port : Integer; out SSL : Boolean);
var
  WAOptionsEditor : TWAOptionsEditor;
begin
  Port := 0;
  SSL := False;

  WAOptionsEditor := TWAOptionsEditor.Create;
  try
    NcMonitorConfigProvider := Create_NcMonitorConfigProvider(FNetCrunchClient);
    try
      WAOptionsEditor.Load;
      Port := WAOptionsEditor.Port;
      SSL := WAOptionsEditor.UseSSL;
    finally
      NcMonitorConfigProvider := NIL;
    end;
  finally
    WAOptionsEditor.Free;
  end;
end;

procedure TNetCrunchServerConnection.Close;
begin
  if IsReady then FNetCrunchClient.Close(True);
end;

destructor TNetCrunchServerConnection.Destroy;
begin
  inherited Destroy;
  Close;
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
    WinApi.WinSock.gethostname(NameBuffer, sizeof(NameBuffer));
    PHostEntBuffer := gethostbyname(NameBuffer);
    HostName := String(PHostEntBuffer^.h_name);
    TInAddrBuffer.S_addr := u_long(pu_long(PHostEntBuffer^.h_addr_list^)^);
    IP := String(inet_ntoa(TInAddrBuffer));
  end;
  WSACleanup;
end;

function ResolveDNSName(AName: string): string;
var
  HostEnt: PHostEnt;
begin
  Result := '';
  HostEnt := gethostbyname(PAnsiChar(AnsiString(AName)));
  if Assigned(HostEnt) and (HostEnt^.h_addrtype = AF_INET) then
    Result := string(PAnsiChar(inet_ntoa(PInAddr(HostEnt^.h_addr^)^)));
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

function CheckNetCrunchWebAppServerConnection (AServerURL, AUser, APassword: PAnsiChar) : Integer; stdcall;
var
  NetCrunchServerConnection : TNetCrunchWebAppConnection;
  CheckCode : Integer;
  Api : TVariantArray;
  Version, Major, Minor, Build : Integer;

begin
  NetCrunchServerConnection := TNetCrunchWebAppConnection.Create(String(AnsiString(AServerURL)), String(AnsiString(AUser)),
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

function ReadNetCrunchServerConfig(AAddress, APort, APassword: PAnsiChar) : PAnsiChar; stdcall;
var
  NetCrunchConnection : TNetCrunchServerConnection;
  Address : String;
  Port : String;
  Password : String;
  ConnectionStatus : Integer;
  CurrentServerVersion : String;
  WebAccessPort : Integer;
  WebAccessUseSSL : Boolean;
  ServerConfigList : TStrings;
  ServerConfig : String;
begin
  Address := ResolveDNSName(String(AnsiString(AAddress)));
  Port := String(AnsiString(APort));
  Password := EncodeNcConsolePassword(String(AnsiString(APassword)));

  NetCrunchConnection := TNetCrunchServerConnection.Create(Address, Port, Password);
  ServerConfigList := TStringList.Create;
  try
    if (Address <> '') then begin
      NetCrunchConnection.Connect;
      ConnectionStatus := NetCrunchConnection.GetConnectionStatus;
      if (ConnectionStatus = NC_AUTHENTICATE_OK) then begin
        CurrentServerVersion := NetCrunchConnection.GetServerVersion;
        if (CompareVersion(PAnsiChar(AnsiString(CurrentServerVersion)),
                           MIN_NETCRUNCH_SERVER_VERSION) in [0, 1]) then begin
          ServerConfigList.Add(IntToStr(0));
          ServerConfigList.Add(Address);
          ServerConfigList.Add(CurrentServerVersion);
          ServerConfigList.Add(NetCrunchConnection.GetGrafCrunchUserPass);
          NetCrunchConnection.GetWebAppServerConfig(WebAccessPort, WebAccessUseSSL);
          ServerConfigList.Add(IntToStr(WebAccessPort));
          if WebAccessUseSSL
            then ServerConfigList.Add('https')
            else ServerConfigList.Add('http');
        end else begin
          ServerConfigList.Add(IntToStr(NC_WRONG_SERVER_VERSION));
          ServerConfigList.Add(CurrentServerVersion);
        end;
        NetCrunchConnection.Close;
      end else begin
        ServerConfigList.Add(IntToStr(ConnectionStatus));
      end;
    end else begin
      ServerConfigList.Add(IntToStr(HOST_ADDRESS_RESOLVE_ERROR));
    end;
  finally
    ServerConfigList.Delimiter := '~';
    ServerConfig := ServerConfigList.DelimitedText;
    NetCrunchConnection.Free;
    ServerConfigList.Free;
  end;
  Result := PAnsiChar(AnsiString(ServerConfig));
end;

end.

