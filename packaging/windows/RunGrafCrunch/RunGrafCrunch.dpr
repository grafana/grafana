program RunGrafCrunch;

{$APPTYPE CONSOLE}

uses
  System.SysUtils,
  Windows,
  ShellAPI,
  StrUtils,
  ShFolder,
  uRemoteService;

var
  Path: string;

  procedure ExecuteViaShell(const AFile, AParameters: string; HideWindow: Boolean = False);
  var
    ErrorCode: HINST;
  begin
    if HideWindow then
      ErrorCode := ShellExecute(0, 'open', PChar(AFile), PChar(AParameters), PChar(Path), SW_HIDE)
    else
      ErrorCode := ShellExecute(0, 'open', PChar(AFile), PChar(AParameters), PChar(Path), SW_SHOWDEFAULT);
    if (ErrorCode <= 32) then begin
      OutputDebugString(PChar(SysErrorMessage(ErrorCode)));
      ExitCode := 5;
    end;
  end;

  function GetSystemPath: string;
  var
    Buffer: array[0..MAX_PATH] of Char;
  begin
    Result := '';
    if (SHGetFolderPath(0, CSIDL_SYSTEM, 0, 1, Buffer) = S_OK) then
      Result := IncludeTrailingPathDelimiter(StrPas(Buffer));
  end;

const
  COMMANDS_ARRAY: array[0..1] of string = ('start', 'stop');
  GC_GUARD_SVC_NAME = 'GrafCrunchGuardService';

{$R *.res}
{$R VERINFO.RES}

var
  Switch : string;
  Service : TRemoteService;

begin
  Path := ExtractFilePath(ParamStr(0));
  if (ParamCount < 1) then begin
    ExitCode := 1;
    Exit;
  end;

  Switch := ParamStr(1);
  if (Length(Switch) = 0) or (not CharInSet(Switch[1], SwitchChars)) then begin
    ExitCode := 2;
    Exit;
  end;
  Delete(Switch, 1, 1);
  case AnsiIndexText(Switch, COMMANDS_ARRAY) of
    0 : ExecuteViaShell(GetSystemPath + 'net.exe', Format('start %s', [GC_GUARD_SVC_NAME]), True);
    1 : begin
          Service := TRemoteService.Create;
          try
            Service.ReadOnly := False;
            Service.ServiceName := GC_GUARD_SVC_NAME;
            if Service.Connect then
              try
                Service.Stop(True);
              finally
                Service.Disconnect;
              end;
          finally
            Service.Free;
          end;
        end;
    else
      ExitCode := 3;
  end;
end.

