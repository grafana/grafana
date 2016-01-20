{****************************************************************
 *
 * Author : Boguslaw Gorczyca
 * Created: 2015-10-06
 *
 * No part of this file may be duplicated, revised, translated,
 * localized or modified in any manner or compiled, linked or
 * uploaded or downloaded to or from any computer system without
 * the prior written consent of AdRem Software sp z o.o.
 *
 * 2015 Copyright AdRem Software, all rights reserved
 ****************************************************************}

unit uGrafCrunchGuardService;

interface

uses
  Winapi.Windows, Winapi.Messages, System.SysUtils, System.Classes, Vcl.Graphics, Vcl.Controls, Vcl.SvcMgr, Vcl.Dialogs,
  uTxTimer;

type

  TGrafCrunchGuardService = class(TService)
    procedure ServiceCreate(Sender: TObject);
    procedure ServiceShutdown(Sender: TService);
    procedure ServiceStart(Sender: TService; var Started: Boolean);
    procedure ServiceStop(Sender: TService; var Stopped: Boolean);
  private
    FGrafCrunchServerProcessId: Cardinal;
    FWatchdogTimerEvent: ITxTimerEvent;
    function ProcessExists(const ProcessName : String) : Boolean;
    function IsServerWorking : Boolean;
    procedure StartGrafCrunchServer;
    procedure StopGrafCrunchServer;
    procedure OnWatchdogTimerEvent(Sender: TObject);
    function ExecuteProcess(const ACommandLine: String; out ProcessId: Cardinal; out SysError: Cardinal;
                            const BaseDir : string) : Boolean;
    procedure FinalizeGuard;
  public
    function GetServiceController: TServiceController; override;
  end;

var
  GrafCrunchGuardService: TGrafCrunchGuardService;

implementation

uses
  uMessages, ShellApi, uAppExceptions, uProcessUtils;

const
  SERVER_NAME = 'GrafCrunch Server';
  SERVER_FILE = 'GCServer.exe';
  MSG_SOURCE = 'GC Guard Service';
  WATCHDOG_TIMER_INTERVAL = 15000;

{$R *.dfm}

procedure LogGuardMessage(const AMsg: string; AMsgLevel: TMessageLevel = tmsMessage);
var
  EventType: DWORD;
begin
  EventType := EVENTLOG_INFORMATION_TYPE;
  if AMsgLevel = tmsWarning then
    EventType := EVENTLOG_WARNING_TYPE
  else if AMsgLevel <= tmsError then
    EventType := EVENTLOG_ERROR_TYPE;
  if Assigned(GrafCrunchGuardService) then
    GrafCrunchGuardService.LogMessage(AMsg, EventType);
  ApplicationMessage(AMsgLevel, MSG_SOURCE, AMsg);
end;

function TGrafCrunchGuardService.ProcessExists(const ProcessName : String) : Boolean;
var
  ProcessList : TStrings;
  ProcessWorking : Boolean;
  I : Integer;
begin
  ProcessWorking := False;
  ProcessList := TStringList.Create;
  try
    GetProcessList(ProcessList);
    for I := 0 to ProcessList.Count-1 do begin
      if (Pos(ProcessName, ProcessList[I]) > 0) then begin
        ProcessWorking := True;
        Break;
      end;
    end;
  finally
    ProcessList.Free;
  end;
  Result := ProcessWorking;
end;

function TGrafCrunchGuardService.IsServerWorking : Boolean;
begin
  try
    if ((FGrafCrunchServerProcessId > 0) and IsProcessActive(FGrafCrunchServerProcessId)) then begin
      Result := True;
    end else begin
      if ProcessExists(SERVER_FILE)
        then Result := True
        else Result := False;
    end;
  except on E: Exception do begin
      LogGuardMessage(SERVER_NAME + ' Exception: ' + E.StackTrace);
      Result := False;
      HandleException(E);
    end;
  end;
end;

procedure TGrafCrunchGuardService.StartGrafCrunchServer;
var
  ErrorCode : Cardinal;
begin
  try
    if ExecuteProcess(SERVER_FILE, FGrafCrunchServerProcessId, ErrorCode, ParamStr(0)) then begin
      LogGuardMessage(SERVER_NAME + ' Started. (PID ' + IntToStr(FGrafCrunchServerProcessId) + ')');
    end else begin
      FGrafCrunchServerProcessId := 0;
      LogGuardMessage(SERVER_NAME + ' Error during start. Error: ' + IntToStr(ErrorCode));
    end;
  except on E: Exception do begin
      LogGuardMessage(SERVER_NAME + ' Exception: ' + E.StackTrace);
      HandleException(E);
    end;
  end;
end;

procedure TGrafCrunchGuardService.StopGrafCrunchServer;
var
  ErrorCode : Cardinal;
begin
  try
    if (IsServerWorking and (FGrafCrunchServerProcessId > 0)) then begin
      if KillProcess(FGrafCrunchServerProcessId, 1, ErrorCode) then begin
        LogGuardMessage(SERVER_NAME + ' Stopped.');
      end else begin
        LogGuardMessage(SERVER_NAME + ' Error during stopping. Error: ' + IntToStr(ErrorCode));
      end;
    end;
    FGrafCrunchServerProcessId := 0;
  except on E: Exception do begin
      LogGuardMessage(SERVER_NAME + ' Exception: ' + E.StackTrace);
      HandleException(E);
    end;
  end;
end;

procedure TGrafCrunchGuardService.OnWatchdogTimerEvent(Sender: TObject);
begin
  if not IsServerWorking then StartGrafCrunchServer;
end;

function TGrafCrunchGuardService.ExecuteProcess(const ACommandLine: String; out ProcessId: Cardinal;
                                                out SysError: Cardinal; const BaseDir : string) : Boolean;
var
  Path: string;
  SI: TStartupInfo;
  PI: TProcessInformation;
  CmdLine : Array[0..MAX_PATH] of Char;

begin
  Result := FALSE;
  Path := ExtractFilePath(BaseDir);
  FillChar(SI, SizeOf(SI), 0);
  FillChar(PI, SizeOf(PI), 0);
  FillChar(CmdLine, SizeOf(CmdLine), 0);
  StrCopy(CmdLine, PChar(Format('"%s"', [Path + ACommandLine])));
  if CreateProcess(NIL, PChar(@CmdLine), NIL, NIL, False, 0, NIL, PChar(Path), SI, PI) then begin
    ProcessId := PI.dwProcessId;
    Result := TRUE;
    CloseHandle(PI.hProcess);
    CloseHandle(PI.hThread);
  end;
  SysError := GetLastError;
end;

procedure TGrafCrunchGuardService.FinalizeGuard;
begin
  if Assigned(FWatchdogTimerEvent) then FWatchdogTimerEvent.Delete;
  FWatchdogTimerEvent := nil;
end;

procedure ServiceController(CtrlCode: DWord); stdcall;
begin
  if Assigned(GrafCrunchGuardService) then GrafCrunchGuardService.Controller(CtrlCode);
end;

function TGrafCrunchGuardService.GetServiceController: TServiceController;
begin
  Result := ServiceController;
end;

procedure TGrafCrunchGuardService.ServiceCreate(Sender: TObject);
begin
  FGrafCrunchServerProcessId := 0;
end;

procedure TGrafCrunchGuardService.ServiceShutdown(Sender: TService);
begin
  LogGuardMessage('Shut down.');
end;

procedure TGrafCrunchGuardService.ServiceStart(Sender: TService; var Started: Boolean);
begin
  FGrafCrunchServerProcessId := 0;
  LogGuardMessage(SERVER_NAME + ' Starting...');
  OnWatchdogTimerEvent(Sender);
  FWatchdogTimerEvent := AppTimer.AddEvent(WATCHDOG_TIMER_INTERVAL, OnWatchdogTimerEvent, False);
  FWatchdogTimerEvent.Activate;
  Started := True;
end;

procedure TGrafCrunchGuardService.ServiceStop(Sender: TService; var Stopped: Boolean);
begin
  FinalizeGuard;
  LogGuardMessage(SERVER_NAME + ' Stopping...');
  StopGrafCrunchServer;
  Stopped := True;
end;

end.

