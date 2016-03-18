@ECHO OFF
SET CurrentDir=%cd%
SET D32="C:\Program Files (x86)\Embarcadero\Studio\17.0\bin\dcc32.exe"
SET D64="C:\Program Files (x86)\Embarcadero\Studio\17.0\bin\dcc64.exe"

echo BUILDING SetupTools
call :CompileDelphiX32 "SetupTools" "packaging\windows\SetupTools"

echo BUILDING GrafCrunchGuard
call :CompileDelphiX64 "GrafCrunchGuard" "packaging\windows\GrafCrunchGuard"

echo BUILDING RunGrafCrunch
call :CompileDelphiX64 "RunGrafCrunch" "packaging\windows\RunGrafCrunch"

goto EndOfScript

:CompileDelphiX32
  @SET FileName=%~1
  @SET BuildDir=%~s2

  call cd %BuildDir%
  call mkdir ".\Win32\Release"
  call %D32% "%FileName%.dpr"
  call :CheckError "COMPILE %FileName%.dpr"
  call cd %CurrentDir%
  echo:
goto :eof

:CompileDelphiX64
  @SET FileName=%~1
  @SET BuildDir=%~s2

  call cd %BuildDir%
  call mkdir ".\Win64\Release"
  call %D64% "%FileName%.dpr"
  call :CheckError "COMPILE %FileName%.dpr"
  call cd %CurrentDir%
  echo:
goto :eof

:CheckError
  if %ERRORLEVEL% NEQ 0 goto BuildError
goto :eof

:BuildError
  @SET MESSAGE=%~1
  ECHO BUILD ERROR: %MESSAGE%
  call cd %CurrentDir%
  EXIT 1
goto :eof

:EndOfScript
