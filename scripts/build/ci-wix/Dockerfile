FROM mcr.microsoft.com/windows:1809

WORKDIR C:\\App

RUN powershell Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
RUN powershell Invoke-Expression (New-Object System.Net.WebClient).DownloadString('https://get.scoop.sh')
RUN powershell scoop install wixtoolset@3.11.2
