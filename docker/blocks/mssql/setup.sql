CREATE LOGIN grafana WITH PASSWORD = 'Password!'
GO

CREATE DATABASE grafana;
GO

USE grafana;
GO

CREATE USER grafana FOR LOGIN grafana;
GO

EXEC sp_addrolemember 'db_owner', 'grafana';
GO
