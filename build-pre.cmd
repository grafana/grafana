@ECHO OFF

echo CLEANING A PREVIOUS BUILD
call grunt clean
call rmdir /S /Q "packaging\windows\GrafCrunchGuard\Win64\Release"
call rmdir /S /Q "packaging\windows\RunGrafCrunch\Win64\Release\"
call rmdir /S /Q "packaging\windows\SetupTools\Win32\Release\"
call del "packaging\windows\release\NC9GrafCrunch.exe"
