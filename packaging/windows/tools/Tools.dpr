library Tools;

uses
  System.SysUtils,
  System.Classes,
  Winsock;

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

exports
  GetHostName;

end.

