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
 * 2010 Copyright AdRem Software, all rights reserved
 ****************************************************************}

program GrafCrunchGuard;
uses
  Vcl.SvcMgr,
  uGrafCrunchGuardService in 'uGrafCrunchGuardService.pas' {GrafCrunchGuardService: TService};

{$R *.RES}

begin
  if not Application.DelayInitialize or Application.Installing then Application.Initialize;
  Application.CreateForm(TGrafCrunchGuardService, GrafCrunchGuardService);
  Application.Run;
end.
