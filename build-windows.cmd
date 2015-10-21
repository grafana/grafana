@ECHO OFF
SET CurrentDir=%cd%
SET IS="C:\Program Files (x86)\Inno Setup 5\iscc.exe"

call grunt clean
call go run build.go build
call grunt release
call :CompileDelphiX32 "SetupTools" "packaging\windows\SetupTools"
call :CompileDelphiX64 "GrafCrunchGuard" "packaging\windows\GrafCrunchGuard"
call :CompileDelphiX64 "RunGrafCrunch" "packaging\windows\RunGrafCrunch"
call %IS% %CurrentDir%"\packaging\windows\install-script.iss"
pause
goto EndOfScript

:CompileDelphiX32
  @SET FileName=%~1
  @SET BuildDir=%~s2

  call cd %BuildDir%
  call mkdir ".\Win32\Release"
  call dcc32.exe "%FileName%.dpr"
  call cd %CurrentDir%
goto :eof

:CompileDelphiX64
  @SET FileName=%~1
  @SET BuildDir=%~s2

  call cd %BuildDir%
  call mkdir ".\Win64\Release"
  call dcc64.exe "%FileName%.dpr"
  call cd %CurrentDir%
goto :eof

:EndOfScript
