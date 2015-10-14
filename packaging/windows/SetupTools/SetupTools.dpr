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

library SetupTools;

uses
  uSetupTools in 'uSetupTools.pas', uTxTimer;

{$R *.res}

function ReadNetCrunchServerConfig(AAddress, APort, APassword: PAnsiChar) : PAnsiChar; stdcall;
begin
  Result := PAnsiChar(AnsiString(''));
  uTxTimer.DoInitialize;
  try
    Result := uSetupTools.ReadNetCrunchServerConfig(AAddress, APort, APassword);
  finally
    uTxTimer.DoFinalize;
  end;
end;

exports
  CompareVersion,
  GetHostName,
  CheckServerPort,
  CheckNetCrunchWebAppServerConnection,
  ReadNetCrunchServerConfig;
end.

