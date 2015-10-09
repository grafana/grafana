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
  uSetupTools in 'uSetupTools.pas';

{$R *.res}

exports
  CompareVersion,
  GetHostName,
  CheckServerPort,
  CheckNetCrunchWebAppServerConnection,
  ReadNetCrunchServerConfig;
end.


