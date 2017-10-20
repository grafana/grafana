#define MyAppID "{5FFA65A5-D4CF-4E26-9AC0-1615E3895B1E}"
#define MyAppName "AdRem GrafCrunch Server"
#define MyAppVersion "9.3.4.3897"
#define FileVersion "9.3.4.3897"
#define MyAppPublisher "AdRem Software, Inc. New York, NY"
#define MyAppURL "http://www.adremsoft.com/"
#define MyAppIcon "icon.ico"
#define MyAppGroupName "AdRem GrafCrunch"
#define MyAppUninstallKey "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\" + MyAppID + "_is1"
#define MyAppGettingStartedArticle "https://www.adremsoft.com/blog/view/blog:v1/5338024126755"

#define LICENSE "..\..\LICENSE.md"
#define NOTICE "..\..\NOTICE.md"

#define GrafCrunchProgramData "{%programdata}\AdRem\GrafCrunch"
#define GrafCrunchClientURL "GrafCrunch Client.url"

#define ConfigINIFile "\conf\custom.ini"
#define ConfigINI "{app}" + ConfigINIFile
#define SetupINI GrafCrunchProgramData + "\setup.ini"
#define VersionFile GrafCrunchProgramData + "\version"
#define UpgradeMarker GrafCrunchProgramData + "\upgrade"
#define PathConfigSection "paths"

#define GrafCrunchServerSection "server"
#define DefaultGrafCrunchServerDomain "localhost"
#define DefaultGrafCrunchServerPort "3000"

#define NetCrunchServerConfigSection "netcrunch-server"
#define DefaultNetCrunchServerAddress ""
#define DefaultNetCrunchServerPortNoSSL "80"
#define DefaultNetCrunchServerPortSSL   "443"
#define DefaultNetCrunchServerProtocolNoSSL "http"
#define DefaultNetCrunchServerProtocolSSL "https"
#define DefaultNetCrunchServerUser "GrafCrunch"

#define NetCrunchServerKey "SOFTWARE\AdRem\NetCrunch\9.0\NCServer\Options\ServerConfiguration"
#define WebAppServerKey "SOFTWARE\AdRem\WebAppSrv\1.0"

#define SignKey ""
#define SignKeyPassword ""
#define TimeStampService "http://timestamp.globalsign.com/scripts/timstamp.dll"

[Setup]
AppId={{#MyAppID}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
AppCopyright=2017 (c) AdRem Software Inc., all rights reserved
VersionInfoVersion={#FileVersion}
LicenseFile={#LICENSE}
DefaultDirName={pf64}\AdRem\GrafCrunch
DefaultGroupName={#MyAppGroupName}
OutputDir=release
OutputBaseFilename=NC10GrafCrunch
SetupIconFile={#MyAppIcon}
UninstallDisplayIcon={#MyAppIcon}
SignTool=AdRemSignTool sign /f "{#SignKey}" /v /p "{#SignKeyPassword}" /t "{#TimeStampService}" $f
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
Filename: {#ConfigINI}; Section: {#PathConfigSection}; Key: "plugins"; String: {#GrafCrunchProgramData}\plugins; Flags: createkeyifdoesntexist

Filename: {#ConfigINI}; Section: {#GrafCrunchServerSection}; Key: "http_port"; String: "{code:GetGrafCrunchServerConfig|Port}"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#GrafCrunchServerSection}; Key: "domain"; String: "{code:GetGrafCrunchServerConfig|Domain}"; Flags: createkeyifdoesntexist

Filename: {#SetupINI}; Section: {#NetCrunchServerConfigSection}; Key: "host"; String: "{code:GetNetCrunchServerConfig|Address}"; Flags: createkeyifdoesntexist; Check: (not IsUpgradeMode);
Filename: {#SetupINI}; Section: {#NetCrunchServerConfigSection}; Key: "port"; String: "{code:GetNetCrunchServerConfig|Port}"; Flags: createkeyifdoesntexist; Check: (not IsUpgradeMode);
Filename: {#SetupINI}; Section: {#NetCrunchServerConfigSection}; Key: "protocol"; String: "{code:GetNetCrunchServerConfig|Protocol}"; Flags: createkeyifdoesntexist; Check: (not IsUpgradeMode);
Filename: {#SetupINI}; Section: {#NetCrunchServerConfigSection}; Key: "user"; String: "{code:GetNetCrunchServerConfig|User}"; Flags: createkeyifdoesntexist; Check: (not IsUpgradeMode);
Filename: {#SetupINI}; Section: {#NetCrunchServerConfigSection}; Key: "password"; String: "{code:GetNetCrunchServerConfig|Password}"; Flags: createkeyifdoesntexist; Check: (not IsUpgradeMode);

[Dirs]
Name: {#GrafCrunchProgramData}

[Files]
Source: "SetupTools\Win32\Release\SetupTools.dll"; Flags: dontcopy 32bit

Source: {#MyAppIcon}; DestDir: "{app}"; Flags: ignoreversion
Source: {#LICENSE}; DestDir: "{app}"; Flags: ignoreversion
Source: {#NOTICE}; DestDir: "{app}"; Flags: ignoreversion

Source: "GrafCrunchGuard\Win64\Release\GrafCrunchGuard.exe"; DestDir: "{app}\bin\"; DestName: "GCGuard.exe"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "RunGrafCrunch\Win64\Release\RunGrafCrunch.exe"; DestDir: "{app}\bin\"; DestName: "GCRun.exe"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dest\bin\grafana-server.exe"; DestDir: "{app}\bin\"; DestName: "GCServer.exe"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dest\bin\grafana-cli.exe"; DestDir: "{app}\bin\"; DestName: "grafana-cli.exe"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dest\conf\*"; DestDir: "{app}\conf\"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dest\data\plugins\*"; DestDir: "{#GrafCrunchProgramData}\plugins"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dest\public\*"; DestDir: "{app}\public\"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dest\scripts\*"; DestDir: "{app}\scripts\"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dest\vendor\*"; DestDir: "{app}\vendor\"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#GrafCrunchClientURL}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\GrafCrunch Client"; Filename: {app}\{#GrafCrunchClientURL}; IconFilename: {app}\{#MyAppIcon}; Comment: "AdRem GrafCrunch Client"; AfterInstall: UpdateGrafCrunchClientURL;
Name: "{commondesktop}\GrafCrunch Client"; Filename: {app}\{#GrafCrunchClientURL}; IconFilename: {app}\{#MyAppIcon}; Comment: "AdRem GrafCrunch Client";
Name: "{group}\GrafCrunch Getting started"; Filename: {#MyAppGettingStartedArticle}; IconFilename: {app}\{#MyAppIcon}; Comment: "AdRem GrafCrunch Getting started";
Name: "{group}\Start GrafCrunch Server"; Filename: {app}\bin\GCRun.exe; Parameters: "-start"; Flags: runminimized; IconFilename: {app}\{#MyAppIcon}; Comment: "Starts AdRem GrafCrunch Server";
Name: "{group}\Stop GrafCrunch Server"; Filename: {app}\bin\GCRun.exe; Parameters: "-stop"; Flags: runminimized; IconFilename: {app}\{#MyAppIcon}; Comment: "Stops AdRem GrafCrunch Server";
Name: "{group}\Uninstall"; Filename: "{uninstallexe}"; Comment: "Uninstall AdRem GrafCrunch Server";

[Run]
Filename: {app}\bin\GCGuard.exe; Parameters: "/install /silent"
Filename: {sys}\sc.exe; Parameters: "description GrafCrunchGuardService ""Provides infrastructure for AdRem GrafCrunch""" ; Flags: runhidden
FileName: {sys}\netsh; Parameters: "advfirewall firewall add rule name= ""AdRem GrafCrunch Server"" dir= in action= allow program= ""{app}\bin\GCServer.exe"" enable=yes"; Flags: runhidden
Filename: {sys}\sc.exe; Parameters: "start GrafCrunchGuardService" ; Flags: runhidden
Filename: {code:GetGrafCrunchServerConfig|URL}; Description: "GrafCrunch Client"; Flags: shellexec nowait postinstall skipifsilent
Filename: {#MyAppGettingStartedArticle}; Description: "GrafCrunch Getting started"; Flags: shellexec nowait postinstall skipifsilent

[UninstallRun]
Filename: {sys}\sc.exe; Parameters: "stop GrafCrunchGuardService" ; Flags: runhidden
Filename: {app}\bin\GCGuard.exe; Parameters: "/uninstall /silent"
FileName: {sys}\netsh; Parameters: "advfirewall firewall delete rule name= ""AdRem GrafCrunch Server"""; Flags: runhidden

[UninstallDelete]
Type: files; Name: {#ConfigINI}

[Code]

function CompareVersion (AVer1, AVer2 : PAnsiChar) : Integer; external 'CompareVersion@files:SetupTools.dll stdcall';
function GetHostName : PAnsiChar; external 'GetHostName@files:SetupTools.dll stdcall';
function CheckServerPort (APort : PAnsiChar) : Integer; external 'CheckServerPort@files:SetupTools.dll stdcall';
function ProcessExists(AProcessName : PAnsiChar) : Boolean; external 'ProcessExists@files:SetupTools.dll stdcall';
function NCServerServiceRunning : Boolean; external 'NCServerServiceRunning@files:SetupTools.dll stdcall';
function CheckNetCrunchWebAppServerConnection (AServerURL, User, Password: PAnsiChar) : Integer; external 'CheckNetCrunchWebAppServerConnection@files:SetupTools.dll stdcall';
function ReadNetCrunchServerConfig(AAddress, APort, APassword: PAnsiChar) : PAnsiChar; external 'ReadNetCrunchServerConfig@files:SetupTools.dll stdcall';

var
  UpdateGrafCrunchServer: Boolean;
  HostName: String;

  GrafCrunchServerConfig: TInputQueryWizardPage;
  NetCrunchServerConfig: TWizardPage;
  NetCrunchServerAddressTextBox: TEdit;
  NetCrunchServerSSL: TCheckBox;
  NetCrunchServerPortTextBox: TEdit;
  NetCrunchServerUserNameTextBox: TEdit;
  NetCrunchServerUserPasswordTextBox: TPasswordEdit;
  UpgradeMode : Boolean;
  InfoPage: TOutputMsgMemoWizardPage;

function GetOldVersion : String;
begin
  Result := '';
  if RegKeyExists(HKEY_LOCAL_MACHINE, '{#MyAppUninstallKey}') then begin
    RegQueryStringValue(HKEY_LOCAL_MACHINE, '{#MyAppUninstallKey}', 'DisplayVersion', Result);
  end;
end;

function CheckVersion : Boolean;
var 
  OldVersion: String;
  CurrentVersion: String;
  Uninstaller: String;
  ErrorCode : Integer;
begin
  OldVersion := GetOldVersion;
  CurrentVersion := '{#MyAppVersion}';

  if (OldVersion <> '') then begin
    if (CompareVersion(OldVersion, CurrentVersion) < 0) then begin
      if (MsgBox('Previous version of {#MyAppName} detected. Do you want to proceed with upgrade to ' + CurrentVersion + ' ?', mbConfirmation, MB_YESNO) = IDNO) then begin
        Result := False;
      end else begin
        RegQueryStringValue(HKEY_LOCAL_MACHINE, '{#MyAppUninstallKey}', 'UninstallString', Uninstaller);
        ShellExec('runas', Uninstaller, '/SILENT', '', SW_HIDE, ewWaitUntilTerminated, ErrorCode);
        Result := True;
      end;
    end else begin
      MsgBox('Version ' + OldVersion + ' of {#MyAppName} is already installed. This installer will exit.', mbInformation, MB_OK);
      Result := False;
    end;
  end else begin
    Result := True;
  end;
end;

function IsUpgradeMode : Boolean;
begin
  Result := UpgradeMode;
end;

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

function CreateTextBox (AParent : TWizardPage; ALeft, ATop, AWidth, ATabOrder : Integer; const ACaption: String) : TEdit;
var 
  LabelHeight : Integer;
  TextBox : TEdit;
begin
  LabelHeight := 0;
  if (ACaption <> '') then begin
    CreateLabel(AParent, 0, ATop, ACaption);
    LabelHeight := 16;
  end;
  TextBox := TEdit.Create(AParent);
  with TextBox do begin
    Parent := AParent.Surface;
    Left := ScaleX(ALeft);
    Top := ScaleY(ATop + LabelHeight);
    Width := ScaleX(AWidth);
    Height := ScaleY(25);
    TabOrder := ATabOrder;
    Text := '';
  end;
  Result := TextBox;
end;

function CreatePasswordTextBox (AParent : TWizardPage; ATop, AWidth, ATabOrder : Integer; const ACaption : String) : TPasswordEdit;
var PasswordTextBox : TPasswordEdit;
begin
  CreateLabel(AParent, 0, ATop, ACaption);
  PasswordTextBox := TPasswordEdit.Create(AParent);
  with PasswordTextBox do begin
    Parent := AParent.Surface;
    Left := ScaleX(0);
    Top := ScaleY(ATop + 16);
    Width := ScaleX(AWidth);
    Height := ScaleY(25);
    TabOrder := ATabOrder;
    Text := '';
  end;
  Result := PasswordTextBox;
end;

function CreateCheckBox (AParent : TWizardPage; ALeft, ATop, AWidth, ATabOrder : Integer; const ACaption: String) : TCheckBox;
var CheckBox : TCheckBox;
begin
  CheckBox := TCheckBox.Create(AParent);
  with CheckBox do begin
    Parent := AParent.Surface;
    Left := ScaleX(ALeft);
    Top := ScaleY(ATop);
    Height := ScaleY(17);
    Width := ScaleX(AWidth);
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
  Result := '';
  if (Param = 'Domain') then begin
    Result := GrafCrunchServerConfig.Values[0];
  end;
  if (Param = 'Port') then begin
    Result := GrafCrunchServerConfig.Values[1];
  end;
  if (Param = 'URL') then begin
    Result := 'http://' + GetGrafCrunchServerConfig('Domain') + ':' + GetGrafCrunchServerConfig('Port') + '/';
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

function GetDefaultNetCrunchServerAddress : String;
var 
  DefaultServerAddress : String;
begin
  if ((HostName <> '') and NCServerServiceRunning)
    then DefaultServerAddress := HostName
    else DefaultServerAddress := '{#DefaultNetCrunchServerAddress}';
  Result := GetDefaultData('{#NetCrunchServerConfigSection}', 'host', DefaultServerAddress, 'NetCrunchAddress');
end;

function GetDefaultNetCrunchSSLMode : Boolean;
var DefaultProtocol : String;
    SSLMode : Cardinal;
    Protocol : String;
begin
  DefaultProtocol := '{#DefaultNetCrunchServerProtocolNoSSL}';

  if not RegQueryDWordValue(HKLM64, ExpandConstant('{#WebAppServerKey}'), 'UseSSL', SSLMode) then begin
    Protocol := GetDefaultData('{#NetCrunchServerConfigSection}', 'protocol', DefaultProtocol, 'NetCrunchProtocol'); 
    Result := (Protocol <> DefaultProtocol);
  end else begin
    Result := (SSLMode <> 0);
  end;
end;

function GetDefaultNetCrunchServerPort (SSLMode : Boolean) : String;
var Port : String;
    PortNumber : Cardinal;
    DefaultNetCrunchPort : String;
    ServerSettings : Boolean;
    ServerSSLMode : Cardinal;
begin
  Port := '';
  ServerSettings := RegQueryDWordValue(HKLM64, ExpandConstant('{#WebAppServerKey}'), 'UseSSL', ServerSSLMode);

  if SSLMode then begin
    DefaultNetCrunchPort := '{#DefaultNetCrunchServerPortSSL}'; 
    if not (ServerSettings and (ServerSSLMode <> 0) and RegQueryDWordValue(HKLM64, ExpandConstant('{#WebAppServerKey}'), 'HttpsPort', PortNumber)) then 
      Port := ''
    else
      Port := IntToStr(PortNumber);
  end else begin
    DefaultNetCrunchPort := '{#DefaultNetCrunchServerPortNoSSL}'; 
    if not (ServerSettings and (ServerSSLMode = 0) and RegQueryDWordValue(HKLM64, ExpandConstant('{#WebAppServerKey}'), 'HttpPort', PortNumber)) then
      Port := ''
    else
      Port := IntToStr(PortNumber);
  end;

  if (Port <> '') then
    Result := Port
  else
    Result := GetDefaultData('{#NetCrunchServerConfigSection}', 'port', DefaultNetCrunchPort, 'NetCrunchPort');
end;

function GetDefaultNetCrunchUsername : String;
begin
  Result := GetDefaultData('{#NetCrunchServerConfigSection}', 'user', '', 'NetCrunchUser');
end;

function GetDefaultNetCrunchServerPassword : String;
begin
  Result := '';
end;

procedure OnSSLModeChange(Sender : TObject);
begin
  NetCrunchServerPortTextBox.Text := GetDefaultNetCrunchServerPort(NetCrunchServerSSL.Checked);
end;

procedure SetNetCrunchServerConfigDefaultValues;
var
  DefaultSSLMode : Boolean;
begin
  DefaultSSLMode := GetDefaultNetCrunchSSLMode;
  NetCrunchServerAddressTextBox.Text := GetDefaultNetCrunchServerAddress;
  NetCrunchServerPortTextBox.Text := GetDefaultNetCrunchServerPort(DefaultSSLMode);
  NetCrunchServerSSL.Checked := DefaultSSLMode;
  NetCrunchServerUserNameTextBox.Text := GetDefaultNetCrunchUsername;
  NetCrunchServerUserPasswordTextBox.Text := GetDefaultNetCrunchServerPassword;
end;

procedure PrepareNetCrunchServerConfigPage;
begin
  NetCrunchServerConfig := CreateCustomPage(GrafCrunchServerConfig.ID, 'NetCrunch Server Configuration', '');
  CreateLabel(NetCrunchServerConfig, 0, 0, 'Please specify NetCrunch server settings, then click Next.');
  NetCrunchServerAddressTextBox := CreateTextBox (NetCrunchServerConfig, 0, 29, NetCrunchServerConfig.SurfaceWidth, 0, 'Server address:');
  CreateLabel(NetCrunchServerConfig, 0, 80, 'Web Access port:');
  NetCrunchServerPortTextBox := CreateTextBox (NetCrunchServerConfig, 95, 77, 50, 1, '');
  NetCrunchServerSSL := CreateCheckBox(NetCrunchServerConfig, 160, 79, 75, 2, 'SSL');
  NetCrunchServerSSL.OnClick := @OnSSLModeChange;
  NetCrunchServerUserNameTextBox := CreateTextBox (NetCrunchServerConfig, 0, 113, NetCrunchServerConfig.SurfaceWidth, 3, 'Username:');
  NetCrunchServerUserPasswordTextBox := CreatePasswordTextBox (NetCrunchServerConfig, 158, NetCrunchServerConfig.SurfaceWidth, 4, 'Password:');
  SetNetCrunchServerConfigDefaultValues;
end;

function GetNetCrunchServerConfig(Param: String) : String;
begin
  Result := '';

  if (not IsUpgradeMode) then begin
    case Param of
      'Address': Result := NetCrunchServerAddressTextBox.Text;
      'Port': Result := NetCrunchServerPortTextBox.Text;
      'Protocol': begin
                    if NetCrunchServerSSL.Checked
                      then Result := '{#DefaultNetCrunchServerProtocolSSL}'
                      else Result := '{#DefaultNetCrunchServerProtocolNoSSL}';
                  end;
      'User': Result := NetCrunchServerUserNameTextBox.Text;
      'Password': Result := NetCrunchServerUserPasswordTextBox.Text;
    end;
  end;
end;

function CheckNetCrunchServerConfig : Boolean;
var 
  Address : String;
  Port : String;
  UserName : String;
  Password : String;
  ErrorMessage : String;
  CheckResult : Integer;
begin
  Address := GetNetCrunchServerConfig('Address');
  Port := GetNetCrunchServerConfig('Port');
  UserName := GetNetCrunchServerConfig('User');
  Password := GetNetCrunchServerConfig('Password');
  ErrorMessage := '';

  Result := False;

  if (Address <> '') then begin
    CheckResult := CheckServerPort(Port);
    if (not (CheckResult in [1, 4])) then begin
      if (UserName <> '') then begin
        if (Password = '') then 
          ErrorMessage := 'Password must be specified';
      end else ErrorMessage := 'Username must be specified';
    end else begin
      case CheckResult of
        1: ErrorMessage := 'Port must be an integer value';
        4: ErrorMessage := 'Port must be greater than zero.';
      end;
    end;
  end else
    ErrorMessage := 'Incorrect NetCrunch server address';    

  if (ErrorMessage <> '') then
    MsgBox(ErrorMessage, mbError, MB_OK)
  else
    Result := True;
end;

procedure UpdateGrafCrunchClientURL;
begin
  SaveStringToFile(ExpandConstant('{app}\{#GrafCrunchClientURL}'), '[InternetShortcut]' + #13#10, False);
  SaveStringToFile(ExpandConstant('{app}\{#GrafCrunchClientURL}'), 'URL=' + GetGrafCrunchServerConfig('URL') + #13#10, True);
end;

procedure PrepareInfoPage;
begin
  InfoPage := CreateOutputMsgMemoPage(wpInstalling, 'GrafCrunch server connection info', '', '', '');
  with InfoPage.RichEditViewer do begin
    Font.Size := 8;
    Lines.Add('');
    Lines.Add('  GrafCrunch is available at: ' + GetGrafCrunchServerConfig('URL'));
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

  with InfoPage.RichEditViewer do begin
    Lines.Add('');
    Lines.Add('  Google Chrome is recommended for working with GrafCrunch.');
  end;
end;

function InitializeSetup : Boolean;
var
  OldVersion : String;
  ConfigINIFile : String;
  DataFolder : String;
begin
  Result := True;
  OldVersion := GetOldVersion;

  if ((OldVersion <> '') and (CompareVersion(OldVersion, '9.2.0.3743') < 0)) then begin
    
    ConfigINIFile := ExpandConstant('{reg:HKLM64\SOFTWARE\AdRem\GrafCrunch\1.0,ConfigFile|""}');  
    DataFolder := ExpandConstant('{#GrafCrunchProgramData}');  

    if (FileExists(ConfigINIFile) and DirExists(DataFolder)) then begin
      FileCopy(ConfigINIFile, ExpandConstant('{#SetupINI}'), false);
      SaveStringToFile(ExpandConstant('{#UpgradeMarker}'), #13#10, False);
    end;
    
  end;

  UpgradeMode := (FileExists(ExpandConstant('{#SetupINI}')) or FileExists(ExpandConstant('{#VersionFile}')));
end;

procedure InitializeWizard;
begin
  if not CheckVersion then Abort;
  UpdateGrafCrunchServer := GrafCrunchServerDatabaseExist;
  HostName := String(AnsiString(GetHostName));
  PrepareGrafCrunchServerConfigPage;
  if (not IsUpgradeMode) then PrepareNetCrunchServerConfigPage;
end;

procedure RegisterPreviousData(PreviousDataKey: Integer);
begin
  SetPreviousData(PreviousDataKey, 'GrafCrunchDomain', GetGrafCrunchServerConfig('Domain'));
  SetPreviousData(PreviousDataKey, 'GrafCrunchPort', GetGrafCrunchServerConfig('Port'));
  SetPreviousData(PreviousDataKey, 'NetCrunchAddress', GetNetCrunchServerConfig('Address'));
  SetPreviousData(PreviousDataKey, 'NetCrunchPort', GetNetCrunchServerConfig('Port'));
  SetPreviousData(PreviousDataKey, 'NetCrunchProtocol', GetNetCrunchServerConfig('Protocol'));
  SetPreviousData(PreviousDataKey, 'NetCrunchUser', GetNetCrunchServerConfig('User'));
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var CheckStatus : Boolean;
begin
  CheckStatus := True;
  if (CurPageID = GrafCrunchServerConfig.ID) then
    CheckStatus := CheckGrafCrunchServerConfig;
  if ((not IsUpgradeMode) and (CurPageID = NetCrunchServerConfig.ID)) then
    CheckStatus := CheckNetCrunchServerConfig;
  Result := CheckStatus;
end;

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin
  PrepareInfoPage;

  Result := MemoDirInfo + NewLine + NewLine +
    'Data location:' + NewLine +
      Space + ExpandConstant('{#GrafCrunchProgramData}') + NewLine + NewLine + 
    
    'GrafCrunch server settings:' + NewLine +   
      Space + 'Domain: ' + GetGrafCrunchServerConfig('Domain') + NewLine + 
      Space + 'Port: ' + GetGrafCrunchServerConfig('Port') + NewLine;

    if (not IsUpgradeMode) then begin
      Result := Result + NewLine + 
        'NetCrunch web server settings:' + NewLine + 
          Space + 'Address: ' + GetNetCrunchServerConfig('Address') + NewLine +
          Space + 'Port: ' + GetNetCrunchServerConfig('Port') + NewLine + 
          Space + 'Protocol: ' + GetNetCrunchServerConfig('Protocol') + NewLine +
          Space + 'User: ' + GetNetCrunchServerConfig('User');;
    end;
end;
