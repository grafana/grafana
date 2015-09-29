#define MyAppName "AdRem GrafCrunch Server"
#define MyAppVersion "1.0"
#define MyAppPublisher "AdRem Software, Inc. New York, NY"
#define MyAppURL "http://www.adremsoft.com/"

#define GrafCrunchProgramData "{%programdata}\AdRem\GrafCrunch"

#define ConfigINI "{app}\conf\custom.ini"
#define PathConfigSection "paths"
#define GrafCrunchServerSection "server"
#define NetCrunchServerConfigSection "netcrunch-server"
#define NetCrunchServerUser "admin"
#define NetCrunchServerPassword "aqqaqq"

[Setup]
AppId={{5FFA65A5-D4CF-4E26-9AC0-1615E3895B1E}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
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

Filename: {#ConfigINI}; Section: {#GrafCrunchServerSection}; Key: "http_port"; String: "3000"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#GrafCrunchServerSection}; Key: "domain"; String: "localhost"; Flags: createkeyifdoesntexist

Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "enable"; String: "true"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "host"; String: "10.20.16.14"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "port"; String: "80"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "protocol"; String: "http"; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "user"; String: {#NetCrunchServerUser}; Flags: createkeyifdoesntexist
Filename: {#ConfigINI}; Section: {#NetCrunchServerConfigSection}; Key: "password"; String: {#NetCrunchServerPassword}; Flags: createkeyifdoesntexist

[Dirs]
Name: {#GrafCrunchProgramData}

[Files]
Source: "dest\bin\*"; DestDir: "{app}\bin\"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dest\conf\*"; DestDir: "{app}\conf\"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dest\public\*"; DestDir: "{app}\public\"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dest\vendor\*"; DestDir: "{app}\vendor\"; Flags: ignoreversion recursesubdirs createallsubdirs

[UninstallDelete]
Type: files; Name: {#ConfigINI}
