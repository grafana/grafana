@ECHO OFF
SET CurrentDir=%cd%
SET IS="C:\Program Files (x86)\Inno Setup 5\iscc.exe"

echo BUILDING SETUP
call %IS% %CurrentDir%"\packaging\windows\install-script.iss"
call :CheckError "COMPILE GRAFCRUNCH SETUP"

goto EndOfScript

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
