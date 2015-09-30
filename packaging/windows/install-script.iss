#define MyAppName "AdRem GrafCrunch Server"
#define MyAppVersion "1.0"
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
#define DefaultNetCrunchServerUser "admin"
#define DefaultNetCrunchServerPassword "aqqaqq"

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
OutputBaseFilename=GCServer
Compression=lzma
SolidCompression=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[INI]
Filename: {#ConfigINI}; Section: {#PathConfigSection}; Key: "data"; String: {#GrafCrunchProgramData}; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#PathConfigSection}; Key: "logs"; String: {#GrafCrunchProgramData}\log; Flags: createkeyifdoesntexist

Filename: {#ConfigINI}; Section: {#GrafCrunchServerSection}; Key: "http_port"; String: "{code:GetGrafCrunchServerConfig|Port}"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#GrafCrunchServerSection}; Key: "domain"; String: "{code:GetGrafCrunchServerConfig|Domain}"; Flags: createkeyifdoesntexist

Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "enable"; String: "true"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "host"; String: "{code:GetNetCrunchServerConfig|Address}"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "port"; String: "{code:GetNetCrunchServerConfig|Port}"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "protocol"; String: "http"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "user"; String: "{code:GetNetCrunchServerConfig|User}"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "password"; String: "{code:GetNetCrunchServerConfig|Password}"; Flags: createkeyifdoesntexist

[Dirs]
Name: {#GrafCrunchProgramData}

[Files]
Source: {#LICENSE}; DestDir: "{app}"; Flags: ignoreversion
Source: {#NOTICE}; DestDir: "{app}"; Flags: ignoreversion

Source: "dest\bin\*"; DestDir: "{app}\bin\"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dest\conf\*"; DestDir: "{app}\conf\"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dest\public\*"; DestDir: "{app}\public\"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dest\vendor\*"; DestDir: "{app}\vendor\"; Flags: ignoreversion recursesubdirs createallsubdirs

[UninstallDelete]
Type: files; Name: {#ConfigINI}

[Code]

var 
  GrafCrunchServerConfig: TInputQueryWizardPage;
  NetCrunchServerConfig: TInputQueryWizardPage;

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
begin
  Result := GetDefaultData('{#GrafCrunchServerSection}', 'domain', '{#DefaultGrafCrunchServerDomain}', 'GrafCrunchDomain');
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

function GetDefaultNetCrunchServerAddress : String;
begin
  Result := GetDefaultData('{#NetCrunchServerConfigSection}', 'host', '{#DefaultNetCrunchServerAddress}', 'NetCrunchAddress');
end;

function GetDefaultNetCrunchServerPort : String;
begin
  Result := GetDefaultData('{#NetCrunchServerConfigSection}', 'port', '{#DefaultNetCrunchServerPort}', 'NetCrunchPort');
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
  NetCrunchServerConfig.Values[0] := GetDefaultNetCrunchServerAddress;
  NetCrunchServerConfig.Values[1] := GetDefaultNetCrunchServerPort;
end;

procedure PrepareNetCrunchServerConfigPage;
begin
  NetCrunchServerConfig := CreateInputQueryPage(GrafCrunchServerConfig.ID, 'NetCrunch Server Configuration', '', 'Please specify NetCrunch server settings, then click Next.');
  NetCrunchServerConfig.Add('NetCrunch server address:', False);
  NetCrunchServerConfig.Add('NetCrunch server Web Access port:', False);
  SetNetCrunchServerConfigDefaultValues;
end;

function GetNetCrunchServerConfig(Param: String) : String;
begin
  if (Param = 'Address') then begin
    Result := NetCrunchServerConfig.Values[0];
  end;
  if (Param = 'Port') then begin
    Result := NetCrunchServerConfig.Values[1];
  end;
  if (Param = 'User') then begin
    Result := GetDefaultNetCrunchServerUser;
  end;
  if (Param = 'Password') then begin
    Result := GetDefaultNetCrunchServerPassword;
  end;
end;

procedure InitializeWizard;
begin
  PrepareGrafCrunchServerConfigPage;
  PrepareNetCrunchServerConfigPage;
end;

procedure RegisterPreviousData(PreviousDataKey: Integer);
begin
  SetPreviousData(PreviousDataKey, 'GrafCrunchDomain', GetGrafCrunchServerConfig('Domain'));
  SetPreviousData(PreviousDataKey, 'GrafCrunchPort', GetGrafCrunchServerConfig('Port'));
  SetPreviousData(PreviousDataKey, 'NetCrunchAddress', GetNetCrunchServerConfig('Address'));
  SetPreviousData(PreviousDataKey, 'NetCrunchPort', GetNetCrunchServerConfig('Port'));
  SetPreviousData(PreviousDataKey, 'NetCrunchUser', GetNetCrunchServerConfig('User'));
  SetPreviousData(PreviousDataKey, 'NetCrunchPassword', GetNetCrunchServerConfig('Password'));
end;

//;**************

//;Get this data from user

//;Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "user"; String: {#NetCrunchServerUser}; Flags: createkeyifdoesntexist
//;Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "password"; String: {#NetCrunchServerPassword}; Flags: createkeyifdoesntexist

//Checking installation of old version
//Get GrafCrunch domain from dns
//GetNetCrunch server setup from registers
//Validate GrafCrunch Server Config data - port bind
//Validate NetCrunch Server Config data -- connection to netcrunch server
//Modify ready to install Information
//Open firewall