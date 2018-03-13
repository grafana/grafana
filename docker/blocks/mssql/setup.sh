#/bin/bash

#wait for the SQL Server to come up
sleep 20s
/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P Password! -d master -i /usr/setup/setup.sql