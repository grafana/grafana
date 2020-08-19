# This has to correspond to the version the Drone runners have
FROM mcr.microsoft.com/windows:1809

WORKDIR C:\\App

RUN powershell Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
RUN powershell Invoke-Expression (New-Object System.Net.WebClient).DownloadString('https://get.scoop.sh')
RUN scoop install wixtoolset@3.11.2
RUN powershell (New-Object Net.WebClient).DownloadFile(\
  \"https://grafana-downloads.storage.googleapis.com/ci-dependencies/nssm-2.24.zip\", \
  \"nssm-2.24.zip\")
RUN scoop install git@2.28.0.windows.1
RUN scoop bucket add extras
RUN scoop install gcloud@305.0.0
# Installing dos2unix fails if not under PowerShell
RUN powershell scoop install dos2unix

ENTRYPOINT ["powershell"]
