library Tools;

uses
  System.SysUtils,
  System.Classes,
  WinApi.Windows,
  Winapi.WinSock,
  WinApi.IpHlpApi,
  WinApi.IpRtrMib;

{$R *.res}

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

function CheckInteger (const StringNumber : String; var Number : Integer) : Boolean;
begin
  try
    Number := StrToInt(StringNumber);
    Result := True;
  except
    Result := False;
  end;
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

exports
  GetHostName,
  CheckServerPort;
end.

