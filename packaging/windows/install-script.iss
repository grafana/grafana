#define MyAppName "AdRem GrafCrunch Server"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "AdRem Software, Inc. New York, NY"
#define MyAppURL "http://www.adremsoft.com/"

#define LICENSE "..\..\LICENSE.md"
#define NOTICE "..\..\NOTICE.md"

#define GrafCrunchProgramData "{%programdata}\AdRem\GrafCrunch"

#define ConfigINIFile "\conf\custom.ini"
#define ConfigINI "{app}" + ConfigINIFile
#define PathConfigSection "paths"

#define GrafCrunchServerSection "server"
#define DefaultGrafCrunchServerDomain "localhost"
#define DefaultGrafCrunchServerPort "3000"

#define NetCrunchServerConfigSection "netcrunch-server"
#define DefaultNetCrunchServerAddress "localhost"
#define DefaultNetCrunchServerPort "80"
#define DefaultNetCrunchServerSSLPort "443"
#define DefaultNetCrunchServerProtocol "http"
#define DefaultNetCrunchServerUser "admin"
#define DefaultNetCrunchServerPassword "aqqaqq"

#define NetCrunchWebAppServerKey "SOFTWARE\AdRem\WebAppSrv\1.0"

[Setup]
AppId={{5FFA65A5-D4CF-4E26-9AC0-1615E3895B1E}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
LicenseFile={#LICENSE}
DefaultDirName={pf64}\AdRem\GrafCrunch
DefaultGroupName=AdRem GrafCrunch
OutputDir=release
OutputBaseFilename=GCServerSetup
Compression=lzma
SolidCompression=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Registry]
Root: HKLM64; Subkey: "Software\AdRem"; Flags: uninsdeletekeyifempty
Root: HKLM64; Subkey: "Software\AdRem\GrafCrunch"; Flags: uninsdeletekey
Root: HKLM64; Subkey: "Software\AdRem\GrafCrunch\1.0"; Flags: uninsdeletekey
Root: HKLM64; Subkey: "Software\AdRem\GrafCrunch\1.0"; ValueType: string; ValueName: "AppFolder"; ValueData: "{app}"
Root: HKLM64; Subkey: "Software\AdRem\GrafCrunch\1.0"; ValueType: string; ValueName: "ConfigFile"; ValueData: "{#ConfigINI}"
Root: HKLM64; Subkey: "Software\AdRem\GrafCrunch\1.0"; ValueType: string; ValueName: "DataFolder"; ValueData: "{#GrafCrunchProgramData}"

[INI]
Filename: {#ConfigINI}; Section: {#PathConfigSection}; Key: "data"; String: {#GrafCrunchProgramData}; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#PathConfigSection}; Key: "logs"; String: {#GrafCrunchProgramData}\log; Flags: createkeyifdoesntexist

Filename: {#ConfigINI}; Section: {#GrafCrunchServerSection}; Key: "http_port"; String: "{code:GetGrafCrunchServerConfig|Port}"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#GrafCrunchServerSection}; Key: "domain"; String: "{code:GetGrafCrunchServerConfig|Domain}"; Flags: createkeyifdoesntexist

Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "enable"; String: "true"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "host"; String: "{code:GetNetCrunchServerConfig|Address}"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "port"; String: "{code:GetNetCrunchServerConfig|Port}"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "protocol"; String: "{code:GetNetCrunchServerConfig|Protocol}"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "user"; String: "{code:GetNetCrunchServerConfig|User}"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "password"; String: "{code:GetNetCrunchServerConfig|Password}"; Flags: createkeyifdoesntexist

[Dirs]
Name: {#GrafCrunchProgramData}

[Files]
Source: "tools\Win32\Release\Tools.dll"; Flags: dontcopy 32bit

Source: {#LICENSE}; DestDir: "{app}"; Flags: ignoreversion
Source: {#NOTICE}; DestDir: "{app}"; Flags: ignoreversion

Source: "GrafCrunchGuard\Win64\Release\GrafCrunchGuard.exe"; DestDir: "{app}\bin\"; DestName: "GCGuard.exe"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dest\bin\grafana-server.exe"; DestDir: "{app}\bin\"; DestName: "GCServer.exe"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dest\conf\*"; DestDir: "{app}\conf\"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dest\public\*"; DestDir: "{app}\public\"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dest\vendor\*"; DestDir: "{app}\vendor\"; Flags: ignoreversion recursesubdirs createallsubdirs

[Run]
Filename: {app}\bin\GCGuard.exe; Parameters: "/install /silent"
Filename: {sys}\sc.exe; Parameters: "description GrafCrunchGuardService ""Provides infrastructure for AdRem GrafCrunch""" ; Flags: runhidden
FileName: {sys}\netsh; Parameters: "advfirewall firewall add rule name= ""AdRem GrafCrunch Server"" dir= in action= allow program= ""{app}\bin\GCServer.exe"" enable=yes"; Flags: runhidden
Filename: {sys}\sc.exe; Parameters: "start GrafCrunchGuardService" ; Flags: runhidden

[UninstallRun]
Filename: {sys}\sc.exe; Parameters: "stop GrafCrunchGuardService" ; Flags: runhidden
Filename: {app}\bin\GCGuard.exe; Parameters: "/uninstall /silent"
FileName: {sys}\netsh; Parameters: "advfirewall firewall delete rule name= ""AdRem GrafCrunch Server"""; Flags: runhidden

[UninstallDelete]
Type: files; Name: {#ConfigINI}

[Code]

function GetHostName : PAnsiChar; external 'GetHostName@files:Tools.dll stdcall';
function CheckServerPort (APort : PAnsiChar) : Integer; external 'CheckServerPort@files:Tools.dll stdcall';
function CheckNetCrunchServerConnection (AServerURL, User, Password: PAnsiChar) : Integer; external 'CheckNetCrunchServerConnection@files:Tools.dll stdcall';

var
  UpdateGrafCrunchServer: Boolean;
  HostName: String;
  GrafCrunchServerConfig: TInputQueryWizardPage;
  NetCrunchServerConfig: TWizardPage;
  NetCrunchServerAddressTextBox: TEdit;
  NetCrunchServerPortTextBox: TEdit;
  NetCrunchServerSSLCheckBox: TCheckBox;
  InfoPage: TOutputMsgMemoWizardPage;

function CreateLabel (AParent : TWizardPage; ALeft, ATop: Integer; const ACaption: String) : TLabel;
var TextLabel : TLabel;
begin
  TextLabel := TLabel.Create(AParent);
  with TextLabel do begin
    Parent := AParent.Surface;
    Left := ScaleX(ALeft);
    Top := ScaleY(ATop);
    Height := ScaleY(17);
    Caption := ACaption;
  end;
  Result := TextLabel;
end;

function CreateTextBox (AParent : TWizardPage; ATop, AWidth, ATabOrder : Integer; const ACaption: String) : TEdit;
var TextBox : TEdit;
begin
  CreateLabel(AParent, 0, ATop, ACaption);
  TextBox := TEdit.Create(AParent);
  with TextBox do begin
    Parent := AParent.Surface;
    Left := ScaleX(0);
    Top := ScaleY(ATop + 16);
    Width := ScaleX(AWidth);
    Height := ScaleY(25);
    TabOrder := ATabOrder;
    Text := '';
  end;
  Result := TextBox;
end;

function CreateCheckBox (AParent : TWizardPage; ATop, ATabOrder : Integer; const ACaption: String) : TCheckBox;
var CheckBox : TCheckBox;
begin
  CheckBox := TCheckBox.Create(AParent);
  with CheckBox do begin
    Parent := AParent.Surface;
    Left := ScaleX(0);
    Top := ScaleY(ATop);
    Height := ScaleY(17);
    Width := AParent.SurfaceWidth;
    Caption := ACaption;
    Checked := False;
    TabOrder := ATabOrder;
  end;
  Result := CheckBox;
end;

function GrafCrunchServerDatabaseExist : Boolean;
begin
  Result := FileExists(ExpandConstant('{#GrafCrunchProgramData}' + '\grafana.db'));
end;

function GetDefaultData (const Section, Key, DefaultValue, PreviousDataKey: String) : String;
var
  NO_PREVIOUS_DATA_VALUE : String;
  DefaultData : String;

begin
  NO_PREVIOUS_DATA_VALUE := '#@$';
  DefaultData := GetPreviousData(PreviousDataKey, NO_PREVIOUS_DATA_VALUE);
  if (DefaultData = NO_PREVIOUS_DATA_VALUE) then begin
    DefaultData := GetIniString(ExpandConstant(Section), Key, ExpandConstant(DefaultValue), WizardDirValue + ExpandConstant('{#ConfigINIFile}'));
  end;
  Result := DefaultData;
end;

function GetDefaultGrafCrunchServerDomain : String;
var 
  DefaultServerDomain : String;

begin
  if (HostName <> '') 
    then DefaultServerDomain := HostName
    else DefaultServerDomain := '{#DefaultGrafCrunchServerDomain}';
  Result := GetDefaultData('{#GrafCrunchServerSection}', 'domain', DefaultServerDomain, 'GrafCrunchDomain');
end;

function GetDefaultGrafCrunchServerPort : String;
begin
  Result := GetDefaultData('{#GrafCrunchServerSection}', 'http_port', '{#DefaultGrafCrunchServerPort}', 'GrafCrunchPort');
end;

procedure SetGrafCrunchServerConfigDefaultValues;
begin
  GrafCrunchServerConfig.Values[0] := GetDefaultGrafCrunchServerDomain;
  GrafCrunchServerConfig.Values[1] := GetDefaultGrafCrunchServerPort;
end;

procedure PrepareGrafCrunchServerConfigPage;
begin
  GrafCrunchServerConfig := CreateInputQueryPage(wpSelectDir, 'GrafCrunch Server Configuration', '', 'Please specify GrafCrunch server settings, then click Next.');
  GrafCrunchServerConfig.Add('GrafCrunch server domain:', False);
  GrafCrunchServerConfig.Add('GrafCrunch server port:', False);
  SetGrafCrunchServerConfigDefaultValues;
end;

function GetGrafCrunchServerConfig(Param: String) : String;
begin
  if (Param = 'Domain') then begin
    Result := GrafCrunchServerConfig.Values[0];
  end;
  if (Param = 'Port') then begin
    Result := GrafCrunchServerConfig.Values[1];
  end;
end;

function CheckGrafCrunchServerConfig : Boolean;
var
  Port : String;
  CheckResult : Integer;
  ErrorMessage : String;

begin
  Port := GetGrafCrunchServerConfig('Port');
  CheckResult := CheckServerPort(Port);
  if (CheckResult > 0) then begin
    case CheckResult of
      1: ErrorMessage := 'Port must be an integer value.';
      2: ErrorMessage := 'Port ' + Port + ' is reserved.';
      3:  ErrorMessage := 'Port ' + Port + ' is not available.';
      4:  ErrorMessage := 'Port must be greater than zero.';
    end;

    MsgBox(ErrorMessage, mbError, MB_OK);
    Result := False;
  end else begin
    Result := True;
  end;
end;

function GetNetCrunchWebAppSrvConfig(const Key : String) : String;
var Value : Cardinal;
begin
  if RegQueryDWordValue(HKLM64, ExpandConstant('{#NetCrunchWebAppServerKey}'), Key, Value) then begin
    Result := IntToStr(Value);
  end else begin
    Result := '';
  end;
end;

function GetNetCrunchWebAppSrvSSLMode : String;
begin
  Result := GetNetCrunchWebAppSrvConfig('UseSSL');
end;

function GetNetCrunchWebAppSrvHttpPort : String;
begin
  Result := GetNetCrunchWebAppSrvConfig('HttpPort');
end;

function GetNetCrunchWebAppSrvHttpsPort : String;
begin
  Result := GetNetCrunchWebAppSrvConfig('HttpsPort');
end;

function GetNetCrunchWebAppSrvSSLModeValue (WebAppSrvSSLMode : String) : Boolean;
begin
  if (WebAppSrvSSLMode <> '') then begin
    Result := (StrToInt(WebAppSrvSSLMode) <> 0);
  end else begin
    Result := False;
  end;
end;

function GetDefaultNetCrunchServerAddress : String;
var 
  DefaultServerAddress : String;

begin
  if (HostName <> '') 
    then DefaultServerAddress := HostName
    else DefaultServerAddress := '{#DefaultNetCrunchServerAddress}';
  Result := GetDefaultData('{#NetCrunchServerConfigSection}', 'host', DefaultServerAddress, 'NetCrunchAddress');
end;

function GetDefaultNetCrunchServerPort : String;
var WebAppSrvPort : String;
    WebAppSrvSSL : String;
    DefaultNetCrunchPort : String;
begin
  WebAppSrvPort := '';
  WebAppSrvSSL := GetNetCrunchWebAppSrvSSLMode;

  if (NetCrunchServerSSLCheckBox.Checked) then begin
    DefaultNetCrunchPort := '{#DefaultNetCrunchServerSSLPort}';
    if ((WebAppSrvSSL <> '') and (GetNetCrunchWebAppSrvSSLModeValue(WebAppSrvSSL))) then begin
      WebAppSrvPort := GetNetCrunchWebAppSrvHttpsPort;
    end;
  end else begin
    DefaultNetCrunchPort := '{#DefaultNetCrunchServerPort}';
    if ((WebAppSrvSSL <> '') and (not GetNetCrunchWebAppSrvSSLModeValue(WebAppSrvSSL))) then begin
      WebAppSrvPort := GetNetCrunchWebAppSrvHttpPort;
    end;
  end;

  if ((WebAppSrvPort <> '') and (WebAppSrvPort <> '0')) then begin
    Result := WebAppSrvPort;
  end else begin
    Result := GetDefaultData('{#NetCrunchServerConfigSection}', 'port', DefaultNetCrunchPort, 'NetCrunchPort');
  end;
end;

function GetDefaultNetCrunchSSL : Boolean;
var WebAppSrvSSL : String;
    Protocol : String;
begin
  WebAppSrvSSL := GetNetCrunchWebAppSrvSSLMode;
  if (WebAppSrvSSL <> '') then begin
    Result := GetNetCrunchWebAppSrvSSLModeValue(WebAppSrvSSL);
  end else begin
    Protocol := GetDefaultData('{#NetCrunchServerConfigSection}', 'protocol', '{#DefaultNetCrunchServerProtocol}', 'NetCrunchProtocol');
    Result := (Protocol = 'https');
  end;
end;

function GetDefaultNetCrunchServerUser : String;
begin
  Result := GetDefaultData('{#NetCrunchServerConfigSection}', 'user', '{#DefaultNetCrunchServerUser}', 'NetCrunchUser');
end;

function GetDefaultNetCrunchServerPassword : String;
begin
  Result := GetDefaultData('{#NetCrunchServerConfigSection}', 'password', '{#DefaultNetCrunchServerPassword}', 'NetCrunchPassword');
end;

procedure SetNetCrunchServerConfigDefaultValues;
begin
  NetCrunchServerAddressTextBox.Text := GetDefaultNetCrunchServerAddress;
  NetCrunchServerSSLCheckBox.Checked := GetDefaultNetCrunchSSL;
  NetCrunchServerPortTextBox.Text := GetDefaultNetCrunchServerPort;
end;

procedure NetCrunchServerSSLCheckBoxOnChange (Sender: TObject);
begin
  if (NetCrunchServerSSLCheckBox.Checked) then begin
    NetCrunchServerPortTextBox.Text := '{#DefaultNetCrunchServerSSLPort}';
  end else begin
    NetCrunchServerPortTextBox.Text := '{#DefaultNetCrunchServerPort}';
  end;
end;

procedure PrepareNetCrunchServerConfigPage;
begin
  NetCrunchServerConfig := CreateCustomPage(GrafCrunchServerConfig.ID, 'NetCrunch Server Configuration', '');
  CreateLabel(NetCrunchServerConfig, 0, 0, 'Please specify NetCrunch server settings, then click Next.');
  NetCrunchServerAddressTextBox := CreateTextBox (NetCrunchServerConfig, 24, NetCrunchServerConfig.SurfaceWidth, 0, 'NetCrunch server address:');
  NetCrunchServerPortTextBox := CreateTextBox (NetCrunchServerConfig, 76, NetCrunchServerConfig.SurfaceWidth, 1, 'NetCrunch server Web Access port:');
  NetCrunchServerSSLCheckBox := CreateCheckBox (NetCrunchServerConfig, 125, 2, 'Use SSL for encryption');
  NetCrunchServerSSLCheckBox.OnClick := @NetCrunchServerSSLCheckBoxOnChange;
  SetNetCrunchServerConfigDefaultValues;
end;

function GetNetCrunchServerConfig(Param: String) : String;
begin
  case Param of
    'Address': Result := NetCrunchServerAddressTextBox.Text;
    'Port': Result := NetCrunchServerPortTextBox.Text;
    'Protocol': begin
                  if (NetCrunchServerSSLCheckBox.Checked) then begin
                    Result := 'https';
                  end else begin
                    Result := 'http';
                  end;
                end;
    'User': Result := GetDefaultNetCrunchServerUser;
    'Password': Result := GetDefaultNetCrunchServerPassword;
  end;
end;

function CheckNetCrunchServerConfig : Boolean;
var 
  NetCrunchServerURL : String;
  CheckResult : Integer;
  ErrorMessage : String;

begin
  NetCrunchServerURL := GetNetCrunchServerConfig('Protocol') + '://' + GetNetCrunchServerConfig('Address') + ':' + GetNetCrunchServerConfig('Port');
  CheckResult := CheckNetCrunchServerConnection (NetCrunchServerURL, GetNetCrunchServerConfig('User'), GetNetCrunchServerConfig('Password'));

  if (CheckResult > 0) then begin
    case CheckResult of
      1, 3: ErrorMessage := 'Can' + #39 + 't connect to NetCrunch server';
      2: ErrorMessage := 'GrafCrunch require NetCrunch server version 9.0.0 or greater';
      4: ErrorMessage := 'Can' + #39 + 't connect to ncapi interface';
    end;
    MsgBox(ErrorMessage, mbError, MB_OK);
    Result := False;
  end else begin
    Result := True;
  end;
end;

procedure PrepareInfoPage;
begin
  InfoPage := CreateOutputMsgMemoPage(wpInstalling, 'GrafCrunch server connection info', '', '', '');
  with InfoPage.RichEditViewer do begin
    Font.Size := 8;
    Lines.Add('');
    Lines.Add('  GrafCrunch is available at: ' + 'http://' + GetGrafCrunchServerConfig('Domain') + ':' + GetGrafCrunchServerConfig('Port'));
    Lines.Add('');
  end;

  if UpdateGrafCrunchServer then begin
    with InfoPage.RichEditViewer do begin
      Lines.Add('  Previous GrafCrunch server data were detected.');
      Lines.Add('  You can log in as previously defined user.');
    end;
  end else begin
    with InfoPage.RichEditViewer do begin
      Lines.Add('  Default GrafCrunch admin was created with credentials:');
      Lines.Add('    User: admin');
      Lines.Add('    Password: admin');
    end;
  end;
end;

procedure InitializeWizard;
begin
  UpdateGrafCrunchServer := GrafCrunchServerDatabaseExist;
  HostName := String(AnsiString(GetHostName));
  PrepareGrafCrunchServerConfigPage;
  PrepareNetCrunchServerConfigPage;
  PrepareInfoPage;
end;

procedure RegisterPreviousData(PreviousDataKey: Integer);
begin
  SetPreviousData(PreviousDataKey, 'GrafCrunchDomain', GetGrafCrunchServerConfig('Domain'));
  SetPreviousData(PreviousDataKey, 'GrafCrunchPort', GetGrafCrunchServerConfig('Port'));
  SetPreviousData(PreviousDataKey, 'NetCrunchAddress', GetNetCrunchServerConfig('Address'));
  SetPreviousData(PreviousDataKey, 'NetCrunchPort', GetNetCrunchServerConfig('Port'));
  SetPreviousData(PreviousDataKey, 'NetCrunchProtocol', GetNetCrunchServerConfig('Protocol'));
  SetPreviousData(PreviousDataKey, 'NetCrunchUser', GetNetCrunchServerConfig('User'));
  SetPreviousData(PreviousDataKey, 'NetCrunchPassword', GetNetCrunchServerConfig('Password'));
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var CheckStatus : Boolean;
begin
  CheckStatus := True;
  case CurPageID of
    GrafCrunchServerConfig.ID: CheckStatus := CheckGrafCrunchServerConfig;
    NetCrunchServerConfig.ID: CheckStatus := CheckNetCrunchServerConfig;
  end;
  Result := CheckStatus;
end;

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin

  Result := MemoDirInfo + NewLine + NewLine +
    'Data location:' + NewLine +
      Space + ExpandConstant('{#GrafCrunchProgramData}') + NewLine + NewLine + 
    
    'GrafCrunch server settings:' + NewLine +   
      Space + 'Domain: ' + GetGrafCrunchServerConfig('Domain') + NewLine + 
      Space + 'Port: ' + GetGrafCrunchServerConfig('Port') + NewLine + NewLine + 
          
    'NetCrunch server settings:' + NewLine + 
      Space + 'Address: ' + GetNetCrunchServerConfig('Address') + NewLine + 
      Space + 'Port: ' + GetNetCrunchServerConfig('Port') + NewLine + 
      Space + 'Protocol: ' + GetNetCrunchServerConfig('Protocol');
end;

//**************
//
//When NetCrunch WebAppServer is in ssl mode - can't connect to it via IdHTTP and validate data
//Connect to NetCrunch Server: get NetCrunch port, getadministrator password
//Get Version, Get password for Grafana user
//Checking installation of old version
//Add shortcuts for start / stop GrafCrunch service
//Implement Modify mode for server config modifications;
//Add proceses descriptions
//Grafana server log problem

//function MyProgCheck(): Boolean;
//begin
//  if not MyProgChecked then begin
    //MyProgCheckResult := MsgBox('Do you want to install MyProg.exe to ' + ExtractFilePath(CurrentFileName) + '?', mbConfirmation, MB_YESNO) = idYes;
    //MyProgChecked := True;
  //end;
  //Result := MyProgCheckResult;
//end;

//function MyDirCheck(DirName: String): Boolean;
//begin
//  Result := DirExists(DirName);
//end;
//;Get this data from user

//;Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "user"; String: {#NetCrunchServerUser}; Flags: createkeyifdoesntexist
//;Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "password"; String: {#NetCrunchServerPassword}; Flags: createkeyifdoesntexistcls
