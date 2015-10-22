@ECHO OFF
SET CurrentDir=%cd%
SET IS="C:\Program Files (x86)\Inno Setup 5\iscc.exe"
SET D32="DCC32.EXE"
SET D64="DCC64.EXE"
SET SignTool="C:\Program Files (x86)\Windows Kits\8.0\bin\x64\signtool.exe"
SET SignKey="Z:\Projects\Keys\AdRem Code-Signing Cert.pfx"
SET TimeStampService="http://timestamp.globalsign.com/scripts/timstamp.dll"
SET GrafCrunchServerEXE="packaging\windows\dest\bin\grafana-server.exe"
SET GrafCrunchGuardEXE="packaging\windows\GrafCrunchGuard\Win64\Release\GrafCrunchGuard.exe"
SET RunGrafCrunchEXE="packaging\windows\RunGrafCrunch\Win64\Release\RunGrafCrunch.exe"
SET GrafCrunchSetupEXE="packaging\windows\release\GCServerSetup.exe"

call grunt clean
call rmdir /S /Q "packaging\windows\GrafCrunchGuard\Win64\Release"
call rmdir /S /Q "packaging\windows\RunGrafCrunch\Win64\Release\"
call rmdir /S /Q "packaging\windows\SetupTools\Win32\Release\"
call rm "packaging\windows\release\GCServerSetup.exe"
call go run build.go build
call grunt release
call :CompileDelphiX32 "SetupTools" "packaging\windows\SetupTools"
call :CompileDelphiX64 "GrafCrunchGuard" "packaging\windows\GrafCrunchGuard"
call :CompileDelphiX64 "RunGrafCrunch" "packaging\windows\RunGrafCrunch"
call :SignFile %GrafCrunchServerEXE% %SignKey% %TimeStampService%
call :SignFile %GrafCrunchGuardEXE% %SignKey% %TimeStampService%
call :SignFile %RunGrafCrunchEXE% %SignKey% %TimeStampService%
call %IS% %CurrentDir%"\packaging\windows\install-script.iss"
call :SignFile %GrafCrunchSetupEXE% %SignKey% %TimeStampService%
pause
goto EndOfScript

:CompileDelphiX32
  @SET FileName=%~1
  @SET BuildDir=%~s2

  call cd %BuildDir%
  call mkdir ".\Win32\Release"
  call %D32% "%FileName%.dpr"
  call cd %CurrentDir%
goto :eof

:CompileDelphiX64
  @SET FileName=%~1
  @SET BuildDir=%~s2

  call cd %BuildDir%
  call mkdir ".\Win64\Release"
  call %D64% "%FileName%.dpr"
  call cd %CurrentDir%
goto :eof

:SignFile
  @SET FileName=%~s1
  @SET KeyFileName=%~s2
  @SET TimeStampService=%~3

  call %SignTool% sign /f "%KeyFileName%" /v /t "%TimeStampService%" "%FileName%"
  call cd %CurrentDir%
goto :eof

:EndOfScript
