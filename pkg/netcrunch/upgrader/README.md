
UPGRADE TO GC 9.2
-----------------
```
  IF "upgrade" file exist
    SET initialization success
  ENDIF
```

UPGRADE TO GC 9.4
-----------------
```
IF "version" exist && "version" < "9.4.0"
  UPGRADE OLD NETCRUNCH DATASOURCES FOR ALL ORGANIZATIONS
ENDIF
```

UPGRADE TO GC 10.0
------------------
```
IF "version" < "10.0.0"
  CHANGE TYPES OF NETCRUNCH DATASOURCES FOR ALL ORGANIZATIONS
ENDIF
```

```
  WRITE VERSION FILE
```  
