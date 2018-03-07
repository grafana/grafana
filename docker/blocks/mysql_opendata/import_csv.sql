use testdata;
DROP TABLE IF EXISTS `nyc_open_data`;
CREATE TABLE IF NOT EXISTS `nyc_open_data` (
  UniqueKey bigint(255),
  `CreatedDate` varchar(255),
  `ClosedDate` varchar(255),
  Agency varchar(255),
  AgencyName varchar(255),
  ComplaintType varchar(255),
  Descriptor varchar(255),
  LocationType varchar(255),
  IncidentZip varchar(255),
  IncidentAddress varchar(255),
  StreetName varchar(255),
  CrossStreet1 varchar(255),
  CrossStreet2 varchar(255),
  IntersectionStreet1 varchar(255),
  IntersectionStreet2 varchar(255),
  AddressType varchar(255),
  City varchar(255),
  Landmark varchar(255),
  FacilityType varchar(255),
  Status varchar(255),
  `DueDate` varchar(255),
  ResolutionDescription varchar(2048),
  `ResolutionActionUpdatedDate` varchar(255),
  CommunityBoard varchar(255),
  Borough varchar(255),
  XCoordinateStatePlane varchar(255),
  YCoordinateStatePlane varchar(255),
  ParkFacilityName varchar(255),
  ParkBorough varchar(255),
  SchoolName varchar(255),
  SchoolNumber varchar(255),
  SchoolRegion varchar(255),
  SchoolCode varchar(255),
  SchoolPhoneNumber varchar(255),
  SchoolAddress varchar(255),
  SchoolCity varchar(255),
  SchoolState varchar(255),
  SchoolZip varchar(255),
  SchoolNotFound varchar(255),
  SchoolOrCitywideComplaint varchar(255),
  VehicleType varchar(255),
  TaxiCompanyBorough varchar(255),
  TaxiPickUpLocation varchar(255),
  BridgeHighwayName varchar(255),
  BridgeHighwayDirection varchar(255),
  RoadRamp varchar(255),
  BridgeHighwaySegment varchar(255),
  GarageLotName varchar(255),
  FerryDirection varchar(255),
  FerryTerminalName varchar(255),
  Latitude varchar(255),
  Longitude varchar(255),
  Location varchar(255)
);
LOAD DATA INFILE '/var/lib/mysql-files/311_Service_Requests_from_2015.csv' INTO TABLE nyc_open_data FIELDS OPTIONALLY ENCLOSED BY '"' TERMINATED BY ',' IGNORE 1 LINES;
UPDATE nyc_open_data SET CreatedDate = STR_TO_DATE(CreatedDate, '%m/%d/%Y %r') WHERE CreatedDate <> '';
UPDATE nyc_open_data SET ClosedDate = STR_TO_DATE(ClosedDate, '%m/%d/%Y %r') WHERE ClosedDate <> '';
UPDATE nyc_open_data SET DueDate = STR_TO_DATE(DueDate, '%m/%d/%Y %r') WHERE DueDate <> '';
UPDATE nyc_open_data SET ResolutionActionUpdatedDate = STR_TO_DATE(ResolutionActionUpdatedDate, '%m/%d/%Y %r') WHERE ResolutionActionUpdatedDate <> '';

UPDATE nyc_open_data SET CreatedDate=null WHERE CreatedDate = '';
UPDATE nyc_open_data SET ClosedDate=null WHERE ClosedDate = '';
UPDATE nyc_open_data SET DueDate=null WHERE DueDate = '';
UPDATE nyc_open_data SET ResolutionActionUpdatedDate=null WHERE ResolutionActionUpdatedDate = '';

ALTER TABLE nyc_open_data modify CreatedDate datetime NULL;
ALTER TABLE nyc_open_data modify ClosedDate datetime NULL;
ALTER TABLE nyc_open_data modify DueDate datetime NULL;
ALTER TABLE nyc_open_data modify ResolutionActionUpdatedDate datetime NULL;

ALTER TABLE `nyc_open_data` ADD INDEX `IX_ComplaintType` (`ComplaintType`);
ALTER TABLE `nyc_open_data` ADD INDEX `IX_CreatedDate` (`CreatedDate`);
ALTER TABLE `nyc_open_data` ADD INDEX `IX_LocationType` (`LocationType`);
ALTER TABLE `nyc_open_data` ADD INDEX `IX_AgencyName` (`AgencyName`);
ALTER TABLE `nyc_open_data` ADD INDEX `IX_City` (`City`);

SYSTEM rm /var/lib/mysql-files/311_Service_Requests_from_2015.csv
