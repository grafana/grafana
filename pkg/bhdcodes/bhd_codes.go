// BMC File
package bhdcodes

const (
	CalcFieldModifiedSuccess   = "bhd-00001"
	CalcFieldDeletedSuccess    = "bhd-00002"
	CalcFieldCreatedSuccess    = "bhd-00003"
	CalcFieldGetFailed         = "bhd-00004"
	CalcFieldCreateFailed      = "bhd-00005"
	CalcFieldDeleteFailed      = "bhd-00006"
	CalcFieldModifyFailed      = "bhd-00007"
	CalcFieldDashUpdateFailed  = "bhd-00008"
	CalcFieldDashDeleteFailed  = "bhd-00009"
	CalcFieldCreateBadPayload  = "bhd-00010"
	CalcFieldDeleteBadPayload  = "bhd-00011"
	CalcFieldModifyBadPayload  = "bhd-00012"
	CalcFieldNameAlreadyExists = "bhd-00013"
)

const (
	PreferencesUpdatedSuccess       = "bhd-00101"
	PreferencesIMSUserBadRequest    = "bhd-00102"
	PreferencesUserUpdateBadRequest = "bhd-00103"
	PreferencesOrgUpdateBadRequest  = "bhd-00104"
	PreferencesFailedToParseBody    = "bhd-00105"
	PreferencesInvalidTheme         = "bhd-00106"
	PreferencesDashboardNotFound    = "bhd-00107"
	PreferencesInternalServerError  = "bhd-00108"
	PreferencesGetFailed            = "bhd-00109"
	PreferencesSaveFailed           = "bhd-00110"
	PreferencesUpdateFailed         = "bhd-00111"
)

const (
	FolderIDInvalid                    = "bhd-00201"
	FolderCreateBadRequest             = "bhd-00202"
	FolderUpdateBadRequest             = "bhd-00203"
	FolderMoveBadRequest               = "bhd-00204"
	FolderPermissionsBadRequest        = "bhd-00205"
	TeamUserPermissionsRoleConflict    = "bhd-00206"
	PermissionsConflictUserTeam        = "bhd-00207"
	FolderTitleEmpty                   = "bhd-00208"
	FolderDashboardChangeNotAllowed    = "bhd-00209"
	FolderUIDContainsIllegalChars      = "bhd-00210"
	FolderUIDTooLong                   = "bhd-00211"
	FolderContainsLibraryElementsInUse = "bhd-00212"
	FolderAccessDenied                 = "bhd-00213"
	NestedFolderFeatureRequired        = "bhd-00214"
	FolderNotFound                     = "bhd-00215"
	FolderWithSameNameExists           = "bhd-00216"
	FolderWithSameUIDExists            = "bhd-00217"
	FolderChangedByAnotherUser         = "bhd-00218"
	FolderMoveFailed                   = "bhd-00219"
	FolderAPIError                     = "bhd-00220"
	FolderPermissionsGetFailed         = "bhd-00221"
	FolderPermissionsCheckFailed       = "bhd-00222"
	FolderPermissionCreateFailed       = "bhd-00223"
	FolderDeleted                      = "bhd-00224"
	FolderPermissionsUpdated           = "bhd-00225"
)

const (
	DashboardDeleteUseFoldersEndpoint    = "bhd-00301"
	DashboardIDInvalid                   = "bhd-00302"
	DashboardRestoreVersionBadRequest    = "bhd-00303"
	DashboardRestoreDeletedBadRequest    = "bhd-00304"
	DashboardDiffBadRequest              = "bhd-00305"
	DashboardCreateOrUpdateBadRequest    = "bhd-00306"
	DashboardSaveUseFoldersEndpoint      = "bhd-00307"
	DashboardProvisionedCannotDelete     = "bhd-00308"
	DashboardQuotaReached                = "bhd-00309"
	DashboardAccessDenied                = "bhd-00310"
	DashboardNotFound                    = "bhd-00311"
	DashboardFolderNotFound              = "bhd-00312"
	DashboardVersionNotFound             = "bhd-00313"
	DashboardPublicRetrieveError         = "bhd-00314"
	DashboardInvalidDataLoadError        = "bhd-00315"
	DashboardStarCheckError              = "bhd-00316"
	DashboardFolderReadFailed            = "bhd-00317"
	DashboardProvisionedCheckError       = "bhd-00318"
	DashboardDeleteFailed                = "bhd-00319"
	DashboardQuotaGetFailed              = "bhd-00320"
	DashboardDiffComputeFailed           = "bhd-00321"
	DashboardLibraryPanelsConnectError   = "bhd-00322"
	DashboardPermissionsUpdateFailed     = "bhd-00323"
	DashboardPermissionsCheckError       = "bhd-00324"
	DashboardPermissionsGetFailed        = "bhd-00325"
	DashboardPreferencesGetFailed        = "bhd-00326"
	DashboardLoadHomeFailed              = "bhd-00327"
	DashboardRestoreFailed               = "bhd-00328"
	DashboardPermissionsUpdated          = "bhd-00329"
	DashboardGitOpsBroadcast             = "bhd-00330"
	DashboardPermissionsUpdateBadRequest = "bhd-00331"
)

const (
	LibraryElementCreateBadRequest           = "bhd-00401"
	LibraryElementUpdateBadRequest           = "bhd-00402"
	LibraryElementPermissionDenied           = "bhd-00403"
	LibraryElementGetFolderFailed            = "bhd-00404"
	LibraryElementCreateFailed               = "bhd-00405"
	LibraryElementDeleteFailed               = "bhd-00406"
	LibraryElementPermissionEvaluationFailed = "bhd-00407"
	LibraryElementsGetFailed                 = "bhd-00408"
	LibraryElementGetFailed                  = "bhd-00409"
	LibraryElementPermissionEvalError        = "bhd-00410"
	LibraryElementGetConnectionsFailed       = "bhd-00411"
	LibraryElementUpdateFailed               = "bhd-00412"
	LibraryElementDeleted                    = "bhd-00413"
	LibraryElementDuplicateNameOrUID         = "bhd-00414"
	LibraryElementNotFound                   = "bhd-00415"
	LibraryElementConnectionNotFound         = "bhd-00416"
	LibraryElementFolderNotFound             = "bhd-00417"
	LibraryElementChangedByAnotherUser       = "bhd-00418"
	LibraryElementFolderAccessDenied         = "bhd-00419"
	LibraryElementHasConnections             = "bhd-00420"
	LibraryElementUIDIllegalCharacters       = "bhd-00421"
	LibraryElementUIDTooLong                 = "bhd-00422"
)

const (
	SnapshotOrgIDMismatch        = "bhd-00501"
	SnapshotAccessDenied         = "bhd-00502"
	SnapshotKeyEmpty             = "bhd-00503"
	SnapshotDashboardNotFound    = "bhd-00504"
	SnapshotNotFound             = "bhd-00505"
	SnapshotGetFailed            = "bhd-00506"
	SnapshotDeleteFailed         = "bhd-00507"
	SnapshotExternalDeleteFailed = "bhd-00508"
	SnapshotPermissionCheckError = "bhd-00509"
	SnapshotSearchFailed         = "bhd-00510"
	SnapshotDeleted              = "bhd-00511"
)

const (
	ErrorNotFound             = "bhd-00601"
	ErrorInternalServerError  = "bhd-00602"
	ErrorAuthenticationFailed = "bhd-00603"
	UnauthorizedOldTokenEmpty = "bhd-00604"
	FailedToAuthenticate      = "bhd-00605"
	Unauthorized              = "bhd-00606"
	LoggedIn                  = "bhd-00607"
)

const (
	OrgUserIDInvalid                     = "bhd-00701"
	OrgNameTaken                         = "bhd-00702"
	OrgBadRequest                        = "bhd-00703"
	OrgUpdateCurrentBadRequest           = "bhd-00704"
	OrgUpdateAddressBadRequest           = "bhd-00705"
	OrgAddUserBadRequest                 = "bhd-00706"
	OrgUpdateUsersBadRequest             = "bhd-00707"
	OrgUpdateBadRequest                  = "bhd-00708"
	OrgUpdateOrgAddressBadRequest        = "bhd-00709"
	OrgCreateBadRequest                  = "bhd-00710"
	OrgUpdateUserBadRequest              = "bhd-00711"
	OrgInviteAddBadRequest               = "bhd-00712"
	OrgCustomConfigAddBadRequest         = "bhd-00713"
	OrgInvalidRole                       = "bhd-00714"
	OrgIDInvalid                         = "bhd-00715"
	OrgCannotRemoveLastAdminByRoleChange = "bhd-00716"
	OrgCannotRemoveLastAdmin             = "bhd-00717"
	OrgDeleteNotAllowedForCurrentUser    = "bhd-00718"
	OrgInviteExternalLoginDisabled       = "bhd-00719"
	OrgInvalidURL                        = "bhd-00720"
	OrgRoleAssignmentHigherThanUser      = "bhd-00721"
	OrgOnlyUsersCanCreate                = "bhd-00722"
	OrgPermissionDeniedAddExistingUser   = "bhd-00723"
	OrgNotFound                          = "bhd-00724"
	OrgUserNotFound                      = "bhd-00725"
	OrgDeleteFailedIDNotFound            = "bhd-00726"
	OrgUserAlreadyMember                 = "bhd-00727"
	OrgGetFailed                         = "bhd-00728"
	OrgQuotaGetFailed                    = "bhd-00729"
	OrgUpdateFailed                      = "bhd-00730"
	OrgUpdateAddressFailed               = "bhd-00731"
	OrgGetUsersCurrentFailed             = "bhd-00732"
	OrgAddUserFailed                     = "bhd-00733"
	OrgGetUsersFailed                    = "bhd-00734"
	OrgGetUserAuthInfoFailed             = "bhd-00735"
	OrgUserUpdateFailed                  = "bhd-00736"
	OrgRemoveUserFailed                  = "bhd-00737"
	OrgQuotaUpdateFailed                 = "bhd-00738"
	OrgSearchFailed                      = "bhd-00739"
	OrgUserIDParseFailed                 = "bhd-00740"
	OrgGetInvitesDBFailed                = "bhd-00741"
	OrgExistingUserCheckDBFailed         = "bhd-00742"
	OrgPermissionEvaluationFailed        = "bhd-00743"
	OrgGenerateRandomStringFailed        = "bhd-00744"
	OrgSaveInviteDBFailed                = "bhd-00745"
	OrgSendInviteEmailFailed             = "bhd-00746"
	OrgUpdateInviteEmailSentFailed       = "bhd-00747"
	OrgUpdateInviteStatusFailed          = "bhd-00748"
	OrgUpdated                           = "bhd-00749"
	OrgAddressUpdated                    = "bhd-00750"
	OrgUserAdded                         = "bhd-00751"
	OrgUserUpdated                       = "bhd-00752"
	OrgQuotaUpdated                      = "bhd-00753"
	OrgUserDeleted                       = "bhd-00754"
	OrgDeleted                           = "bhd-00755"
	OrgCreated                           = "bhd-00756"
	OrgInviteRevoked                     = "bhd-00757"
	OrgConfigUpdated                     = "bhd-00758"
	OrgConfigSetToDefault                = "bhd-00759"
	OrgUserRemoved                       = "bhd-00760"
	OrgUserCreateError                   = "bhd-00761"
	OrgSendInviteEmailToOrgFailed        = "bhd-00762"
	OrgSMTPNotConfigured                 = "bhd-00763"
	OrgCreateFailed                      = "bhd-00764"
	OrgAddNewUserBadRequest              = "bhd-00765"
)

const (
	PermissionActionConflict           = "bhd-00801"
	PermissionSearchOptionMissing      = "bhd-00802"
	PermissionInvalidNamespacedID      = "bhd-00803"
	PermissionGetOrgUserFailed         = "bhd-00804"
	PermissionGetFailed                = "bhd-00805"
	PermissionBadRequest               = "bhd-00806"
	PermissionSetUserBadRequest        = "bhd-00807"
	PermissionSetTeamBadRequest        = "bhd-00808"
	PermissionSetBuiltinRoleBadRequest = "bhd-00809"
	PermissionsUpdated                 = "bhd-00810"
	PermissionUpdated                  = "bhd-00811"
	PermissionRemoved                  = "bhd-00812"
)

const (
	DatasourceCreateBadRequest           = "bhd-00901"
	DatasourceUpdateByIDBadRequest       = "bhd-00902"
	DatasourceUpdateBadRequest           = "bhd-00903"
	DatasourceAddFailed                  = "bhd-00904"
	DatasourceInvalidID                  = "bhd-00905"
	DatasourceMissingValidID             = "bhd-00906"
	DatasourceInvalidURL                 = "bhd-00907"
	DatasourceInvalidUID                 = "bhd-00908"
	DatasourceMissingUID                 = "bhd-00909"
	DatasourceMissingName                = "bhd-00910"
	DatasourceIDMissing                  = "bhd-00911"
	DatasourceNotFound                   = "bhd-00912"
	DatasourceUpdatePermissionDenied     = "bhd-00913"
	DatasourceAdditionalPermissionNeeded = "bhd-00914"
	DatasourceUpdateReadOnly             = "bhd-00915"
	DatasourceDeleteReadOnly             = "bhd-00916"
	DatasourceDeletePermissionDenied     = "bhd-00917"
	DatasourceAccessDenied               = "bhd-00918"
	AccessDenied                         = "bhd-00919"
	DatasourceUpdateConflict             = "bhd-00920"
	DatasourcesQueryFailed               = "bhd-00921"
	DatasourceQueryFailed                = "bhd-00922"
	DatasourceAddFailedExtended          = "bhd-00923"
	DatasourceDeleteFailedExtended       = "bhd-00924"
	DatasourceAddFailure                 = "bhd-00925"
	DatasourceUpdateFailure              = "bhd-00926"
	DatasourceUpdateFailureExtended      = "bhd-00927"
	DatasourceDeleteFailure              = "bhd-00928"
	DatasourceMetadataLoadFailed         = "bhd-00929"
	PluginContextGetFailed               = "bhd-00930"
	PluginRequestFailed                  = "bhd-00931"
	PluginResponseUnmarshalFailed        = "bhd-00932"
	DatasourceAdded                      = "bhd-00933"
	DatasourceUpdated                    = "bhd-00934"
	DatasourceDeleted                    = "bhd-00935"
	CorrelationAddBadRequest             = "bhd-00936"
	CorrelationMissingRequiredFields     = "bhd-00937"
	CorrelationUpdateBadRequest          = "bhd-00938"
	CorrelationProvisionOnly             = "bhd-00939"
	CorrelationNotFoundGeneral           = "bhd-00940"
	CorrelationSourceNotFound            = "bhd-00941"
	CorrelationNotFound                  = "bhd-00942"
	CorrelationGetFailed                 = "bhd-00943"
	CorrelationAddFailed                 = "bhd-00944"
	CorrelationFetchFailed               = "bhd-00945"
	CorrelationDeleteFailed              = "bhd-00946"
	CorrelationUpdateFailed              = "bhd-00947"
	CorrelationCreated                   = "bhd-00948"
	CorrelationDeleted                   = "bhd-00949"
	CorrelationUpdated                   = "bhd-00950"
)

const (
	QueryHistoryAddBadRequest           = "bhd-01001"
	QueryHistoryUpdateCommentBadRequest = "bhd-01002"
	QueryHistoryNotFound                = "bhd-01003"
	QueryHistoryCreateFailed            = "bhd-01004"
	QueryHistoryGetFailed               = "bhd-01005"
	QueryHistoryDeleteFailed            = "bhd-01006"
	QueryHistoryStarFailed              = "bhd-01007"
	QueryHistoryUnstarFailed            = "bhd-01008"
	QueryHistoryUpdateCommentFailed     = "bhd-01009"
	QueryHistoryDeleted                 = "bhd-01010"
	QueryHistorydeleteFailed            = "bhd-01011"
	QueryHistorystarFailed              = "bhd-01012"
	QueryHistoryunstarFailed            = "bhd-01013"
	QueryHistoryCommentUpdateFailed     = "bhd-01014"
)

const (
	PluginInstallBadRequest        = "bhd-01101"
	PluginUpdateSettingsBadRequest = "bhd-01102"
	PluginAccessDenied             = "bhd-01103"
	PluginModifyCoreError          = "bhd-01104"
	PluginUninstallCoreError       = "bhd-01105"
	PluginNotFoundByID             = "bhd-01106"
	PluginNotInstalled             = "bhd-01107"
	PluginFileNotFound             = "bhd-01108"
	PluginAlreadyInstalled         = "bhd-01109"
	PluginListFetchFailed          = "bhd-01110"
	PluginMarkdownFetchFailed      = "bhd-01111"
	PluginSettingsFetchFailed      = "bhd-01112"
	PluginUnmarshalResponseFailed  = "bhd-01113"
	PluginInstallFailed            = "bhd-01114"
	PluginUninstallFailed          = "bhd-01115"
	PluginDashboardsFetchFailed    = "bhd-01116"
	PluginUpdateSettingsFailed     = "bhd-01117"
	PluginSettingsUpdated          = "bhd-01118"
)

const (
	AnnotationMassDeleteBadRequest     = "bhd-01201"
	AnnotationCreateBadRequest         = "bhd-01202"
	AnnotationUpdateBadRequest         = "bhd-01203"
	AnnotationGraphiteCreateBadRequest = "bhd-01204"
	AnnotationIDInvalid                = "bhd-01205"
	AnnotationGraphiteSaveFailed       = "bhd-01206"
	AnnotationInvalidDashboardUID      = "bhd-01207"
	AnnotationMassDeleteAccessDenied   = "bhd-01208"
	AnnotationSaveAccessDenied         = "bhd-01209"
	AnnotationNotFound                 = "bhd-01210"
	AnnotationPermissionCheckFailed    = "bhd-01211"
	AnnotationDeleteFailed             = "bhd-01212"
	AnnotationSingleDeleteFailed       = "bhd-01213"
	AnnotationSaveFailed               = "bhd-01214"
	AnnotationUpdateFailed             = "bhd-01215"
	AnnotationTagsFetchFailed          = "bhd-01216"
	AnnotationFetchFailed              = "bhd-01217"
	AnnotationsGetFailed               = "bhd-01218"
	AnnotationsDeleted                 = "bhd-01219"
	AnnotationCreated                  = "bhd-01220"
	AnnotationUpdated                  = "bhd-01221"
	AnnotationPatched                  = "bhd-01222"
	GraphiteAnnotationCreated          = "bhd-01223"
	AnnotationDeleted                  = "bhd-01224"
)

const (
	ErrorBadRequestData               = "bhd-01301"
	ErrorInvalidOperation             = "bhd-01302"
	ErrorInvalidValueAndType          = "bhd-01303"
	ErrorInvalidRequestBody           = "bhd-01304"
	ErrorInvalidJSONFormat            = "bhd-01305"
	ErrorInvalidUserId                = "bhd-01306"
	ErrorMissingRoleName              = "bhd-01307"
	ErrorCannotUpdateSystemRole       = "bhd-01308"
	ErrorCannotDeleteSystemRole       = "bhd-01309"
	ErrorRoleAssociatedWithUsers      = "bhd-01310"
	ErrorRoleAssociatedWithTeams      = "bhd-01311"
	ErrorInvalidRoleId                = "bhd-01312"
	ErrorFailedToValidateRoleId       = "bhd-01313"
	ErrorRoleIdInvalid                = "bhd-01314"
	ErrorInvalidPayload               = "bhd-01315"
	ErrorUserIdInvalid                = "bhd-01316"
	ErrorUserIdInvalidAlt             = "bhd-01317"
	ErrorTeamIdInvalid                = "bhd-01318"
	ErrorTeamDoesNotExist             = "bhd-01319"
	ErrorInsufficientPermissions      = "bhd-01320"
	ErrorIMSJWTInvalid                = "bhd-01321"
	ErrorAuthHeaderMissing            = "bhd-01322"
	ErrorIMSJWTIncorrect              = "bhd-01323"
	ErrorNoRolesAssigned              = "bhd-01324"
	ErroNotAllowedToFetchDashboards   = "bhd-01325"
	ErrorUnauthorizedAccess           = "bhd-01326"
	ErrornotFound                     = "bhd-01327"
	ErrorNameAlreadyExists            = "bhd-01328"
	ErrorGetDashboardsFailed          = "bhd-01329"
	ErrorGetViewListFailed            = "bhd-01330"
	ErrorGetPersonalizedDataFailed    = "bhd-01331"
	ErrorDeletePersonalizedDataFailed = "bhd-01332"
	ErrorPermissionCheckError         = "bhd-01334"
	ErrorRetrieveFailed               = "bhd-01335"
	ErrorDashboardQueryAdminError     = "bhd-01336"
	ErrorDashboardQueryError          = "bhd-01337"
	ErrorinternalServerError          = "bhd-01338"
	ErrorGetFailed                    = "bhd-01339"
	ErrorUpdateFailed                 = "bhd-01340"
	ErrorDeleteFailed                 = "bhd-01341"
	ErrorSearchFailed                 = "bhd-01342"
	ErrorUpdateUserRoleFailed         = "bhd-01343"
	ErrorUpdateTeamRoleFailed         = "bhd-01344"
	ErrorGetPermissionsListFailed     = "bhd-01345"
	ErrorUpdatePermissionsListFailed  = "bhd-01346"
	ErrorSearchUsersFailed            = "bhd-01347"
	ErrorUserRoleMappingAddFailed     = "bhd-01348"
	ErrorUserRoleMappingRemoveFailed  = "bhd-01349"
	ErrorTeamRoleAddFailed            = "bhd-01350"
	ErrorTeamRoleRemoveFailed         = "bhd-01351"
	ErrorUnexpectedError              = "bhd-01352"
	SuccesNotImplemented              = "bhd-01353"
	SuccessPersonalizedDataDeleted    = "bhd-01354"
	SuccessOK                         = "bhd-01355"
	SuccessuthorizedAccess            = "bhd-01356"
	SuccessPermissionsUpdated         = "bhd-01357"
	SuccessUserRoleMappingAdded       = "bhd-01358"
	SuccessUserRoleMappingRemoved     = "bhd-01359"
	SuccessTeamRoleAdded              = "bhd-01361"
	SuccessTeamRoleRemoved            = "bhd-01362"
	SuccessLocaleUpdated              = "bhd-01363"
	ErrorRecordNotFound               = "bhd-01364"
	ErrorCreateFailed                 = "bhd-01365"
	ErrorSearchTeamsFailed            = "bhd-01366"
	ErrorTeamidInvalid                = "bhd-01367"
	ErrorViewNotFound                 = "bhd-01368"
	ErrorFetchViewFailed              = "bhd-01369"
	ErrorSQLGenerationFailed          = "bhd-01370"
)

const (
	PlaylistUpdateBadRequest = "bhd-01401"
	PlaylistCreateBadRequest = "bhd-01402"
	PlaylistSearchFailed     = "bhd-01403"
	PlaylistNotFound         = "bhd-01404"
	PlaylistDeleteFailed     = "bhd-01405"
	PlaylistSaveFailed       = "bhd-01406"
	PlaylistLoadFailed       = "bhd-01407"
	PlaylistCreateFailed     = "bhd-01408"
)

const (
	ReportInvalidID                       = "bhd-01501"
	ReportBadRequestData                  = "bhd-01502"
	ReportInvalidJobID                    = "bhd-01503"
	ReportCreateBadRequest                = "bhd-01504"
	ReportRecipientsRequired              = "bhd-01505"
	ReportDomainRestrictionFailed         = "bhd-01506"
	ReportInvalidCronExpression           = "bhd-01507"
	ReportUpdateBadRequest                = "bhd-01508"
	ReportInvalidReportID                 = "bhd-01509"
	ReportInternalDomainRestrictionFailed = "bhd-01510"
	ReportNoneToDelete                    = "bhd-01511"
	ReportFTPPayloadBadRequest            = "bhd-01512"
	ReportFTPModifyPayloadBadRequest      = "bhd-01513"
	ReportFTPDefaultPayloadBadRequest     = "bhd-01514"
	ReportSendMailBadRequest              = "bhd-01515"
	ReportExecuteOnceBadRequest           = "bhd-01516"
	ReportIDNotSpecified                  = "bhd-01517"
	ReportDisableSchedulerBadRequest      = "bhd-01518"
	ReportEmptySchedulerList              = "bhd-01519"
	ReportSchedulerDuplicateName          = "bhd-01520"
	ReportIncompleteData                  = "bhd-01521"
	ReportDashboardEditNotAllowed         = "bhd-01522"
	ReportTenantDetailsNotFound           = "bhd-01523"
	ReportBrandingSettingsBadRequest      = "bhd-01524"
	ReportInvalidLogoExtension            = "bhd-01525"
	ReportInvalidImageURLExtension        = "bhd-01526"
	ReportInvalidLogoURL                  = "bhd-01527"
	ReportInvalidFooterURL                = "bhd-01528"
	ReportTenantDetailsUpsertBadRequest   = "bhd-01529"
	ReportNotInStorage                    = "bhd-01530"
	ReportFileNotAvailable                = "bhd-01531"
	ReportExternalRecipients              = "bhd-01532"
	ReportSchedulerNotFound               = "bhd-01533"
	ReportScheduleLimitExceeded           = "bhd-01534"
	ReportGetPreviousFTPConfigFailed      = "bhd-01535"
	ReportSchedulerDeleteBadRequest       = "bhd-01537"
	ReportSchedulerEnableBadRequest       = "bhd-01538"
	ReportExternalBCCRecipients           = "bhd-01539"
	ReportRecipientsNotInWhitelist        = "bhd-01540"
	ReportBCCNotInWhitelist               = "bhd-01541"
	ReportFetchFailed                     = "bhd-01542"
	FTPConfigAlreadyExists                = "bhd-01543"
	FTPConfigAddFailed                    = "bhd-01544"
	FTPConfigUpdateFailed                 = "bhd-01545"
	ReportPreviewBadRequest               = "bhd-01546"
	FTPDefaultDeletionNotAllowed          = "bhd-01547"
	FTPUsedInScheduler                    = "bhd-01548"
	FTPConfigDeleteFailed                 = "bhd-01549"
	ReportDeleteOrgFailed                 = "bhd-01550"
	ReportDisableOrgFailed                = "bhd-01551"
	FTPConnectionFailed                   = "bhd-01552"
	ReportCreateSuccess                   = "bhd-01553"
	ReportUpdateSuccess                   = "bhd-01554"
	ReportDeleteSuccess                   = "bhd-01555"
	ReportsDeleteSuccess                  = "bhd-01556"
	ReportUserDeleteSuccess               = "bhd-01557"
	FTPConfigSaveSuccess                  = "bhd-01558"
	FTPConfigUpdateSuccess                = "bhd-01559"
	FTPConfiguredAsDefault                = "bhd-01560"
	FTPConfigDeleteSuccess                = "bhd-01561"
	ReportSchedulesDeleteDisableSuccess   = "bhd-01562"
	ReportEnableSuccess                   = "bhd-01563"
	ReportsEnableSuccess                  = "bhd-01564"
	ReportDisableSuccess                  = "bhd-01565"
	ReportsDisableSuccess                 = "bhd-01566"
	ReportBrandingUpdateSuccess           = "bhd-01567"
	ReportBrandingDefaultSet              = "bhd-01568"
	ReportUpdated                         = "bhd-01569"
	ReportDeleted                         = "bhd-01570"
	ReportOwnerUpdatedSuccess             = "bhd-01571"
)

const (
	UsersUserUpdateBadRequest              = "bhd-01601"
	UsersAuthProxyEmailChangeNotAllowed    = "bhd-01602"
	UsersAuthProxyUsernameChangeNotAllowed = "bhd-01603"
	UsersInvalidEmailAddress               = "bhd-01604"
	UsersInvalidUserID                     = "bhd-01605"
	UsersDashboardStarOnlyUsersAllowed     = "bhd-01606"
	UsersInvalidDashboardUID               = "bhd-01607"
	UsersInvalidOrgID                      = "bhd-01608"
	UsersDashboardGetStarOnlyUsersAllowed  = "bhd-01609"
	UsersChangePasswordBadRequest          = "bhd-01610"
	UsersRevokeTokenBadRequest             = "bhd-01611"
	UsersUserUpdateGeneralBadRequest       = "bhd-01612"
	UsersInvalidOrganization               = "bhd-01613"
	UsersEntityNotAllowedToRevokeTokens    = "bhd-01614"
	UsersEntityNotAllowedToGetTokens       = "bhd-01615"
	UsersEndpointOnlyForUsers              = "bhd-01616"
	UsersUserLoginConflict                 = "bhd-01617"
	UsersFailedToGetUser                   = "bhd-01618"
	UsersFailedToGetUserOrganizations      = "bhd-01620"
	UsersFailedToGetUserStars              = "bhd-01621"
	UsersFailedToFetchDashboards           = "bhd-01622"
	UsersFailedToStarDashboard             = "bhd-01623"
	UsersFailedToUnstarDashboard           = "bhd-01624"
	UsersFailedToChangePassword            = "bhd-01625"
	UsersFailedToGetOrgQuotas              = "bhd-01626"
	UsersFailedToUpdateHelpFlag            = "bhd-01627"
	UsersFailedToGenerateEmailVerification = "bhd-01628"
	UsersFailedToParseUserID               = "bhd-01629"
	UsersFailedToGetUserTeams              = "bhd-01630"
	UsersFailedToUpdateUser                = "bhd-01631"
	UsersFailedToParseUserIDAgain          = "bhd-01632"
	UsersOrgChanged                        = "bhd-01633"
	UsersDashboardStarred                  = "bhd-01634"
	UsersDashboardUnstarred                = "bhd-01635"
	UsersUserPasswordChanged               = "bhd-01636"
	UsersHelpFlagSet                       = "bhd-01637"
	UsersUserUpdated                       = "bhd-01638"
	UsersVerificationEmailSent             = "bhd-01639"
	UsersUserNotFound                      = "bhd-01640"
	UsersUserAuthTokenNotFound             = "bhd-01641"
	UsersFailedToChangeActiveOrg           = "bhd-01642"
	UsersFailedToRevokeUserToken           = "bhd-01643"
	UsersFailedToGetUserToken              = "bhd-01644"
	UsersCannotRevokeActiveToken           = "bhd-01645"
	UsersUserAuthTokenRevoked              = "bhd-01646"
)

const (
	AdminUserCreateBadRequest        = "bhd-01701"
	AdminRevokeAuthTokenBadRequest   = "bhd-01702"
	AdminSetPermissionsBadRequest    = "bhd-01703"
	AdminSetPasswordBadRequest       = "bhd-01704"
	AdminPasswordTooShort            = "bhd-01705"
	AdminInvalidID                   = "bhd-01706"
	AdminCannotLogoutSelf            = "bhd-01707"
	AdminCannotRemoveLastAdmin       = "bhd-01708"
	AdminNotFound                    = "bhd-01709"
	AdminPasswordResetNotAllowed     = "bhd-01710"
	AdminCannotChangeAdminRole       = "bhd-01711"
	AdminFailedToAuthorizeSettings   = "bhd-01712"
	AdminLoginEmailConflict          = "bhd-01713"
	AdminFailedToGetAdminStats       = "bhd-01714"
	AdminFailedToGetAnonStats        = "bhd-01715"
	AdminFailedToReencryptKeys       = "bhd-01716"
	AdminFailedToRotateKeys          = "bhd-01717"
	AdminFailedToCreate              = "bhd-01718"
	AdminFailedToReadFromDB          = "bhd-01719"
	AdminFailedToUpdatePassword      = "bhd-01720"
	AdminFailedToUpdatePermissions   = "bhd-01721"
	AdminFailedToDelete              = "bhd-01722"
	AdminFailedToDisableExternal     = "bhd-01723"
	AdminFailedToDisable             = "bhd-01724"
	AdminFailedToEnableExternal      = "bhd-01725"
	AdminFailedToEnable              = "bhd-01726"
	AdminFailedToGet                 = "bhd-01727"
	AdminFailedToGetAuthTokens       = "bhd-01728"
	AdminFailedToLogout              = "bhd-01729"
	AdminSessionsNotRevoked          = "bhd-01730"
	AdminPasswordUpdated             = "bhd-01731"
	AdminPermissionsUpdated          = "bhd-01732"
	AdminDeleted                     = "bhd-01733"
	AdminDisabled                    = "bhd-01734"
	AdminEnabled                     = "bhd-01735"
	AdminLoggedOut                   = "bhd-01736"
	AdminCreated                     = "bhd-01737"
	AdminFailedToReencryptSecrets    = "bhd-01740"
	AdminFailedToUpdateOrgQuotas     = "bhd-01741"
	AdminFailedToRollbackSecrets     = "bhd-01742"
	AdminFailedToReloadPluginsConfig = "bhd-01746"
	AdminOrgQuotaUpdated             = "bhd-01748"
	AdminDashboardsConfigReloaded    = "bhd-01753"
	AdminPluginsConfigReloaded       = "bhd-01754"
	AdminDatasourcesConfigReloaded   = "bhd-01755"
	AdminAlertingConfigReloaded      = "bhd-01756"

	GlobalkeysLimitExceeded = "bhd-01757"
)

func MapMsgToCode(msg string) string {
	if code, ok := messageToCodeMap[msg]; ok {
		return code
	}
	return ""
}

var messageToCodeMap = map[string]string{
	"Fields Modified Successfully":                                             CalcFieldModifiedSuccess,
	"Field(s) Deleted Successfully":                                            CalcFieldDeletedSuccess,
	"Failed to get Calculated Fields":                                          CalcFieldGetFailed,
	"Failed to create calculated field":                                        CalcFieldCreateFailed,
	"Failed to delete calculated field":                                        CalcFieldDeleteFailed,
	"Failed to modify calculated field":                                        CalcFieldModifyFailed,
	"Failed to Update Dashboards":                                              CalcFieldDashUpdateFailed,
	"Failed to delete field from Dashboard(s)":                                 CalcFieldDashDeleteFailed,
	"bad request payload while creating calculated field":                      CalcFieldCreateBadPayload,
	"bad request payload while deleting calculated field":                      CalcFieldDeleteBadPayload,
	"bad request payload while modifying calculated field":                     CalcFieldModifyBadPayload,
	"Calculated field name is already taken. Please provide a different name.": CalcFieldNameAlreadyExists,

	"Preferences updated":                              PreferencesUpdatedSuccess,
	"bad request data while setting IMS user info":     PreferencesIMSUserBadRequest,
	"bad request data while updating user preferences": PreferencesUserUpdateBadRequest,
	"bad request data while updating org. preferences": PreferencesOrgUpdateBadRequest,
	"Failed parse body":                                PreferencesFailedToParseBody,
	"Invalid theme when updating preferences":          PreferencesInvalidTheme,
	"Dashboard not found":                              PreferencesDashboardNotFound,
	"Internal server error":                            PreferencesInternalServerError,
	"Failed to get preferences":                        PreferencesGetFailed,
	"Failed to save preferences":                       PreferencesSaveFailed,
	"Failed to update user preferences":                PreferencesUpdateFailed,

	"id is invalid":                                                           FolderIDInvalid,
	"bad request data while creating folder":                                  FolderCreateBadRequest,
	"bad request data while updating folder":                                  FolderUpdateBadRequest,
	"bad request data when moving folder":                                     FolderMoveBadRequest,
	"bad request data while updating folder permissions":                      FolderPermissionsBadRequest,
	"team and user permissions cannot have an associated role":                TeamUserPermissionsRoleConflict,
	"permissions cannot have both a user and team":                            PermissionsConflictUserTeam,
	"folder title cannot be empty":                                            FolderTitleEmpty,
	"Dashboard cannot be changed to a folder":                                 FolderDashboardChangeNotAllowed,
	"uid contains illegal characters":                                         FolderUIDContainsIllegalChars,
	"uid too long, max 40 characters":                                         FolderUIDTooLong,
	"Folder could not be deleted because it contains library elements in use": FolderContainsLibraryElementsInUse,
	"Access denied": FolderAccessDenied,
	"a folder/dashboard with the same uid already exists": FolderWithSameUIDExists,
	"move folder failed":                      FolderMoveFailed,
	"Folder API error":                        FolderAPIError,
	"Failed to get folder permissions":        FolderPermissionsGetFailed,
	"Error while checking folder permissions": FolderPermissionsCheckFailed,
	"Failed to create permission":             FolderPermissionCreateFailed,
	"Folder permissions updated":              FolderPermissionsUpdated,

	"Use folders endpoint for deleting folders.":           DashboardDeleteUseFoldersEndpoint,
	"dashboardId is invalid":                               DashboardIDInvalid,
	"bad request data while restoring dashboard version":   DashboardRestoreVersionBadRequest,
	"bad request data while restoring deleted dashboard":   DashboardRestoreDeletedBadRequest,
	"bad request data while calculating dashboard diff":    DashboardDiffBadRequest,
	"bad request data when creating or updating dashboard": DashboardCreateOrUpdateBadRequest,
	"Use folders endpoint for saving folders.":             DashboardSaveUseFoldersEndpoint,
	"provisioned dashboard cannot be deleted":              DashboardProvisionedCannotDelete,
	"Quota reached":                                            DashboardQuotaReached,
	"Access denied to this dashboard":                          DashboardAccessDenied,
	"Folder not found":                                         DashboardFolderNotFound,
	"Dashboard version not found":                              DashboardVersionNotFound,
	"Error while retrieving public dashboards":                 DashboardPublicRetrieveError,
	"Error while loading dashboard, dashboard data is invalid": DashboardInvalidDataLoadError,
	"Error while checking if dashboard was starred by user":    DashboardStarCheckError,
	"Dashboard folder could not be read":                       DashboardFolderReadFailed,
	"Error while checking if dashboard is provisioned":         DashboardProvisionedCheckError,
	"Failed to delete dashboard":                               DashboardDeleteFailed,
	"Failed to get quota":                                      DashboardQuotaGetFailed,
	"Unable to compute diff":                                   DashboardDiffComputeFailed,
	"Error while connecting library panels":                    DashboardLibraryPanelsConnectError,
	"Failed to update permissions":                             DashboardPermissionsUpdateFailed,
	"Error while checking dashboard permissions":               DashboardPermissionsCheckError,
	"Failed to get dashboard permissions":                      DashboardPermissionsGetFailed,
	"Failed to load home dashboard":                            DashboardLoadHomeFailed,
	"Dashboard cannot be restored":                             DashboardRestoreFailed,
	"Dashboard permissions updated":                            DashboardPermissionsUpdated,
	"bad request data while updating dashboard permissions":    DashboardPermissionsUpdateBadRequest,

	"bad request data while creating new library element":      LibraryElementCreateBadRequest,
	"bad request data while updating existing library element": LibraryElementUpdateBadRequest,
	"insufficient permissions for getting library panel":       LibraryElementPermissionDenied,
	"failed to get folder":                                     LibraryElementGetFolderFailed,
	"Failed to create library element":                         LibraryElementCreateFailed,
	"Failed to delete library element":                         LibraryElementDeleteFailed,
	"Failed to evaluate permissions":                           LibraryElementPermissionEvaluationFailed,
	"Failed to get library elements":                           LibraryElementsGetFailed,
	"Failed to get library element":                            LibraryElementGetFailed,
	"unable to evaluate library panel permissions":             LibraryElementPermissionEvalError,
	"Failed to get connections":                                LibraryElementGetConnectionsFailed,
	"Failed to update library element":                         LibraryElementUpdateFailed,
	"library element with that name or UID already exists":     LibraryElementDuplicateNameOrUID,
	"library element could not be found":                       LibraryElementNotFound,
	"library element connection could not be found":            LibraryElementConnectionNotFound,
	"folder not found":                                         LibraryElementFolderNotFound,
	"the library element has been changed by someone else":     LibraryElementChangedByAnotherUser,
	"access denied to folder":                                  LibraryElementFolderAccessDenied,
	"the library element has connections":                      LibraryElementHasConnections,

	"OrgID mismatch":                                SnapshotOrgIDMismatch,
	"Access denied to this snapshot":                SnapshotAccessDenied,
	"Empty snapshot ke":                             SnapshotKeyEmpty,
	"Dashboard snapshot not found":                  SnapshotDashboardNotFound,
	"Snapshot not found":                            SnapshotNotFound,
	"Failed to get dashboard snapshot":              SnapshotGetFailed,
	"Failed to delete dashboard snapshot":           SnapshotDeleteFailed,
	"Failed to delete external dashboard":           SnapshotExternalDeleteFailed,
	"Error while checking permissions for snapshot": SnapshotPermissionCheckError,
	"Search failed":                                 SnapshotSearchFailed,

	"Failed to authenticate":            ErrorAuthenticationFailed,
	"Unauthorized - Old Token is empty": UnauthorizedOldTokenEmpty,
	"Unauthorized":                      Unauthorized,

	"userId is invalid":       OrgUserIDInvalid,
	"Organization name taken": OrgNameTaken,
	"bad request data":        OrgBadRequest,
	"bad request data while updating current organization":               OrgUpdateCurrentBadRequest,
	"bad request data while updating current Organization's address":     OrgUpdateAddressBadRequest,
	"bad request data while adding new user to the current organization": OrgAddUserBadRequest,
	"bad request data while updating users in organization":              OrgUpdateUsersBadRequest,
	"bad request data while updating organization":                       OrgUpdateBadRequest,
	"bad request data wile updating organization's address":              OrgUpdateOrgAddressBadRequest,
	"bad request data while creating organization":                       OrgCreateBadRequest,
	"bad request data while updating given user":                         OrgUpdateUserBadRequest,
	"bad request data when adding organization invite":                   OrgInviteAddBadRequest,
	"bad request data when adding custom configuration":                  OrgCustomConfigAddBadRequest,
	"Invalid role specified":                                             OrgInvalidRole,
	"orgId is invalid":                                                   OrgIDInvalid,
	"Cannot change role so that there is no organization admin left":     OrgCannotRemoveLastAdminByRoleChange,
	"Cannot remove last organization admin":                              OrgCannotRemoveLastAdmin,
	"Can not delete org for current user":                                OrgDeleteNotAllowedForCurrentUser,
	"Cannot invite external user when login is disabled.":                OrgInviteExternalLoginDisabled,
	"Invalid Url": OrgInvalidURL,
	"Cannot assign a role higher than user's role":                                  OrgRoleAssignmentHigherThanUser,
	"Only users can create organizations":                                           OrgOnlyUsersCanCreate,
	"Permission denied: not permitted to add an existing user to this organisation": OrgPermissionDeniedAddExistingUser,
	"Organization not found":                                                        OrgNotFound,
	"User not found":                                                                OrgUserNotFound,
	"Failed to delete organization. ID not found":                                   OrgDeleteFailedIDNotFound,
	"Failed to get organization":                                                    OrgGetFailed,
	"failed to get quota":                                                           OrgQuotaGetFailed,
	"Failed to update organization":                                                 OrgUpdateFailed,
	"Failed to update org address":                                                  OrgUpdateAddressFailed,
	"Failed to get users for current organization":                                  OrgGetUsersCurrentFailed,
	"Could not add user to organization":                                            OrgAddUserFailed,
	"Failed to get users for organization":                                          OrgGetUsersFailed,
	"Failed to get user auth info":                                                  OrgGetUserAuthInfoFailed,
	"Failed update org user":                                                        OrgUserUpdateFailed,
	"Failed to remove user from organization":                                       OrgRemoveUserFailed,
	"Failed to update org quotas":                                                   OrgQuotaUpdateFailed,
	"Failed to search orgs":                                                         OrgSearchFailed,
	"Failed to parse user id":                                                       OrgUserIDParseFailed,
	"Failed to get invites from db":                                                 OrgGetInvitesDBFailed,
	"Failed to query db for existing user check":                                    OrgExistingUserCheckDBFailed,
	"Could not generate random string":                                              OrgGenerateRandomStringFailed,
	"Failed to save invite to database":                                             OrgSaveInviteDBFailed,
	"Failed to send email invite":                                                   OrgSendInviteEmailFailed,
	"Failed to update invite with email sent info":                                  OrgUpdateInviteEmailSentFailed,
	"Failed to update invite status":                                                OrgUpdateInviteStatusFailed,
	"Organization updated":                                                          OrgUpdated,
	"Address updated":                                                               OrgAddressUpdated,
	"Organization user updated":                                                     OrgUserUpdated,
	"Organization quota updated":                                                    OrgQuotaUpdated,
	"User deleted":                                                                  OrgUserDeleted,
	"Organization deleted":                                                          OrgDeleted,
	"Invite revoked":                                                                OrgInviteRevoked,
	"Configuration updated":                                                         OrgConfigUpdated,
	"Configuration is set to default":                                               OrgConfigSetToDefault,
	"User removed from organization":                                                OrgUserRemoved,
	"Error while trying to create org user":                                         OrgUserCreateError,
	"Failed to send email invited_to_org":                                           OrgSendInviteEmailToOrgFailed,
	"SMTP not configured, check your grafana.ini config file's [smtp] section":      OrgSMTPNotConfigured,
	"Failed to create organization":                                                 OrgCreateFailed,
	"bad request data while adding a new user to current organization":              OrgAddNewUserBadRequest,

	"could not get org user permissions":                                     PermissionGetOrgUserFailed,
	"Failed to get permissions":                                              PermissionGetFailed,
	"Bad request data: ":                                                     PermissionBadRequest,
	"bad request data while setting resource permissions for a user":         PermissionSetUserBadRequest,
	"bad request data while setting resource permissions for a team":         PermissionSetTeamBadRequest,
	"bad request data when setting resource permissions for a built-in role": PermissionSetBuiltinRoleBadRequest,
	"Permissions updated":                                                    PermissionsUpdated,
	"Permission updated":                                                     PermissionUpdated,
	"Permission removed":                                                     PermissionRemoved,

	"bad request data while creating a data source":                                    DatasourceCreateBadRequest,
	"bad request data while updating an existing data source by its sequential ID":     DatasourceUpdateByIDBadRequest,
	"bad request data while update an existing data source":                            DatasourceUpdateBadRequest,
	"Failed to add datasource":                                                         DatasourceAddFailed,
	"Missing valid datasource id":                                                      DatasourceMissingValidID,
	"Validation error, invalid URL":                                                    DatasourceInvalidURL,
	"UID is invalid":                                                                   DatasourceInvalidUID,
	"Missing datasource uid":                                                           DatasourceMissingUID,
	"Missing valid datasource name":                                                    DatasourceMissingName,
	"Datasource id is missing":                                                         DatasourceIDMissing,
	"Data source not found":                                                            DatasourceNotFound,
	"You do not have enough permission to update datasource":                           DatasourceAdditionalPermissionNeeded,
	"Cannot update read-only data source":                                              DatasourceUpdateReadOnly,
	"Cannot delete read-only data source":                                              DatasourceDeleteReadOnly,
	"You do not have enough permission to delete datasource":                           DatasourceDeletePermissionDenied,
	"Access denied to datasource":                                                      DatasourceAccessDenied,
	"Datasource has already been updated by someone else. Please reload and try again": DatasourceUpdateConflict,
	"Failed to query datasources":                                                      DatasourcesQueryFailed,
	"Failed to query datasource":                                                       DatasourceQueryFailed,
	"Failed to add datasource: ":                                                       DatasourceAddFailedExtended,
	"Failed to delete datasource: ":                                                    DatasourceDeleteFailedExtended,
	"Failed to update datasource: ":                                                    DatasourceUpdateFailureExtended,
	"Failed to delete datasource":                                                      DatasourceDeleteFailure,
	"Unable to load datasource metadata":                                               DatasourceMetadataLoadFailed,
	"Unable to get plugin context":                                                     PluginContextGetFailed,
	"Plugin request failed":                                                            PluginRequestFailed,
	"Failed to unmarshal detailed response from backend plugin":                        PluginResponseUnmarshalFailed,
	"Data source deleted":                                                              DatasourceDeleted,
	"bad request data while adding correlation":                                        CorrelationAddBadRequest,
	"At least one of label, description or config is required":                         CorrelationMissingRequiredFields,
	"bad request data while updating a correlation":                                    CorrelationUpdateBadRequest,
	"Correlation can only be edited via provisioning":                                  CorrelationProvisionOnly,
	"No correlation found":                                                             CorrelationNotFoundGeneral,
	"Source data source not found":                                                     CorrelationSourceNotFound,
	"Correlation not found":                                                            CorrelationNotFound,
	"Failed to get correlations":                                                       CorrelationGetFailed,
	"Failed to add correlation":                                                        CorrelationAddFailed,
	"Failed to get correlation":                                                        CorrelationFetchFailed,
	"Failed to delete correlation":                                                     CorrelationDeleteFailed,
	"Failed to update correlation":                                                     CorrelationUpdateFailed,

	"bad request data while adding new query to query history":           QueryHistoryAddBadRequest,
	"bad request data while Updating comment for query in query history": QueryHistoryUpdateCommentBadRequest,
	"Query in query history not found":                                   QueryHistoryNotFound,
	"Failed to create query history":                                     QueryHistoryCreateFailed,
	"Failed to get query history":                                        QueryHistoryGetFailed,
	"Failed to delete query from query history":                          QueryHistoryDeleteFailed,
	"Failed to star query in query history":                              QueryHistoryStarFailed,
	"Failed to unstar query in query history":                            QueryHistoryUnstarFailed,
	"Failed to update comment of query in query history":                 QueryHistoryUpdateCommentFailed,
	"Failed to delete query history":                                     QueryHistorydeleteFailed,
	"Failed to star query history":                                       QueryHistorystarFailed,
	"Failed to unstar query history":                                     QueryHistoryunstarFailed,

	"bad request data while installing plugin":       PluginInstallBadRequest,
	"bad request data while updating plugin setting": PluginUpdateSettingsBadRequest,
	"Access Denied":                                      PluginAccessDenied,
	"Cannot install or change a Core plugin":             PluginModifyCoreError,
	"Cannot uninstall a Core plugin":                     PluginUninstallCoreError,
	"Plugin not found, no installed plugin with that id": PluginNotFoundByID,
	"Plugin not installed":                               PluginNotInstalled,
	"file does not exist":                                PluginFileNotFound,
	"Plugin already installed":                           PluginAlreadyInstalled,
	"Failed to get list of plugins":                      PluginListFetchFailed,
	"Could not get markdown file":                        PluginMarkdownFetchFailed,
	"Failed to get plugin settings":                      PluginSettingsFetchFailed,
	"Failed to install plugin":                           PluginInstallFailed,
	"Failed to uninstall plugin":                         PluginUninstallFailed,
	"Failed to get plugin dashboards":                    PluginDashboardsFetchFailed,
	"Failed to update plugin setting":                    PluginUpdateSettingsFailed,
	"Plugin settings updated":                            PluginSettingsUpdated,

	"bad request data while deleting multiple annotations":          AnnotationMassDeleteBadRequest,
	"bad request data while creating annotation":                    AnnotationCreateBadRequest,
	"bad request data while updating annotation":                    AnnotationUpdateBadRequest,
	"bad request data while creating annotation in Graphite format": AnnotationGraphiteCreateBadRequest,
	"annotationId is invalid":                                       AnnotationIDInvalid,
	"Failed to save Graphite annotation":                            AnnotationGraphiteSaveFailed,
	"Invalid dashboard UID in annotation request":                   AnnotationInvalidDashboardUID,
	"Access denied to mass delete annotations":                      AnnotationMassDeleteAccessDenied,
	"Access denied to save the annotation":                          AnnotationSaveAccessDenied,
	"Annotation not found":                                          AnnotationNotFound,
	"Error while checking annotation permissions":                   AnnotationPermissionCheckFailed,
	"Failed to delete annotations":                                  AnnotationDeleteFailed,
	"Failed to delete annotation":                                   AnnotationSingleDeleteFailed,
	"Failed to save annotation":                                     AnnotationSaveFailed,
	"Failed to update annotation":                                   AnnotationUpdateFailed,
	"Failed to find annotation tags":                                AnnotationTagsFetchFailed,
	"Failed to find annotation":                                     AnnotationFetchFailed,
	"Failed to get annotations":                                     AnnotationsGetFailed,
	"Annotations deleted":                                           AnnotationsDeleted,
	"Annotation updated":                                            AnnotationUpdated,
	"Annotation patched":                                            AnnotationPatched,
	"Annotation deleted":                                            AnnotationDeleted,

	"Bad request data":               ErrorBadRequestData,
	"invalid operation":              ErrorInvalidOperation,
	"invalid value and its type":     ErrorInvalidValueAndType,
	"Invalid request body":           ErrorInvalidRequestBody,
	"Invalid JSON format":            ErrorInvalidJSONFormat,
	"Invalid User Id":                ErrorInvalidUserId,
	"Role name is missing":           ErrorMissingRoleName,
	"You cannot update system role.": ErrorCannotUpdateSystemRole,
	"You cannot delete system role.": ErrorCannotDeleteSystemRole,
	"This role is associated with users. Before deleting the role, delete all the associations.": ErrorRoleAssociatedWithUsers,
	"This role is associated with teams. Before deleting the role, delete all the associations.": ErrorRoleAssociatedWithTeams,
	"Role id is invalid":                       ErrorInvalidRoleId,
	"Failed to validated role id":              ErrorFailedToValidateRoleId,
	"Invalid role ID":                          ErrorRoleIdInvalid,
	"Invalid payload":                          ErrorInvalidPayload,
	"User Id is invalid":                       ErrorUserIdInvalidAlt,
	"teamId is invalid":                        ErrorTeamIdInvalid,
	"Team does not exists.":                    ErrorTeamDoesNotExist,
	"User doesn't have enough permissions.":    ErrorInsufficientPermissions,
	"IMS_JWT is invalid":                       ErrorIMSJWTInvalid,
	"Missing or Empty Authorization Header":    ErrorAuthHeaderMissing,
	"IMS_JWT is invalid or incorrect":          ErrorIMSJWTIncorrect,
	"No roles assigned to the user.":           ErrorNoRolesAssigned,
	"Role not allowed to fetch dashboards.":    ErroNotAllowedToFetchDashboards,
	"Role not found":                           ErrornotFound,
	"Role with the same name already exists":   ErrorNameAlreadyExists,
	"Failed to get dashboards":                 ErrorGetDashboardsFailed,
	"Failed to get the view list":              ErrorGetViewListFailed,
	"Failed to get personalized data":          ErrorGetPersonalizedDataFailed,
	"Failed to delete personalized data":       ErrorDeletePersonalizedDataFailed,
	"Error checking permissions":               ErrorPermissionCheckError,
	"Failed to retrieve roles.":                ErrorRetrieveFailed,
	"Error building dashboard query for admin": ErrorDashboardQueryAdminError,
	"Error building dashboard query":           ErrorDashboardQueryError,
	"Internal Server Error":                    ErrorinternalServerError,
	"Failed to get role":                       ErrorGetFailed,
	"Failed to update role":                    ErrorUpdateFailed,
	"Failed to delete role":                    ErrorDeleteFailed,
	"Failed to search roles":                   ErrorSearchFailed,
	"Failed to update Users Role":              ErrorUpdateUserRoleFailed,
	"Failed to update Teams Role":              ErrorUpdateTeamRoleFailed,
	"Failed to get permissions list":           ErrorGetPermissionsListFailed,
	"Failed to update permissions list":        ErrorUpdatePermissionsListFailed,
	"Failed to search Users":                   ErrorSearchUsersFailed,
	"Failed to add user role mapping.":         ErrorUserRoleMappingAddFailed,
	"Failed to remove user role mapping.":      ErrorUserRoleMappingRemoveFailed,
	"Failed to add team role":                  ErrorTeamRoleAddFailed,
	"Failed to remove team role":               ErrorTeamRoleRemoveFailed,
	"unexpected error":                         ErrorUnexpectedError,
	"Not implemented yet":                      SuccesNotImplemented,
	"Personalized data deleted":                SuccessPersonalizedDataDeleted,
	"OK":                                       SuccessOK,
	"User role mapping added.":                 SuccessUserRoleMappingAdded,
	"User role mapping removed for all roles.": SuccessUserRoleMappingRemoved,
	"Team role added.":                         SuccessTeamRoleAdded,
	"Team role removed.":                       SuccessTeamRoleRemoved,
	"Record not found":                         ErrorRecordNotFound,
	"Failed to create role":                    ErrorCreateFailed,
	"Failed to search Teams":                   ErrorSearchTeamsFailed,
	"Team Id is invalid":                       ErrorTeamidInvalid,
	"View not foun":                            ErrorViewNotFound,
	"Failed to fetch view details":             ErrorFetchViewFailed,
	"Unable to generate sql":                   ErrorSQLGenerationFailed,

	"bad request data while updating playlist": PlaylistUpdateBadRequest,
	"bad request data while creating playlist": PlaylistCreateBadRequest,
	"Playlist not found":                       PlaylistNotFound,
	"Failed to delete playlist":                PlaylistDeleteFailed,
	"Failed to save playlist":                  PlaylistSaveFailed,
	"Failed to load playlist":                  PlaylistLoadFailed,
	"Failed to create playlist":                PlaylistCreateFailed,

	"invalid id":     ReportInvalidID,
	"Invalid job id": ReportInvalidJobID,
	"bad request data while creating a report":                                         ReportCreateBadRequest,
	"Recipients are required":                                                          ReportRecipientsRequired,
	"Domain restriction failed":                                                        ReportDomainRestrictionFailed,
	"Invalid cron expression":                                                          ReportInvalidCronExpression,
	"bad request data while updating report":                                           ReportUpdateBadRequest,
	"Invalid report id":                                                                ReportInvalidReportID,
	"Restriction of internal domains only failed":                                      ReportInternalDomainRestrictionFailed,
	"No reports to delete":                                                             ReportNoneToDelete,
	"bad request payload while setting FTP configuration":                              ReportFTPPayloadBadRequest,
	"bad request payload while modifying FTP configurations":                           ReportFTPModifyPayloadBadRequest,
	"bad request payload while setting default FTP configuration":                      ReportFTPDefaultPayloadBadRequest,
	"bad request data while sending mail":                                              ReportSendMailBadRequest,
	"bad request data while executing report once":                                     ReportExecuteOnceBadRequest,
	"ID is not specified":                                                              ReportIDNotSpecified,
	"bad request data while disabling report scheduler":                                ReportDisableSchedulerBadRequest,
	"report scheduler list is empty":                                                   ReportEmptySchedulerList,
	"report scheduler with the same name already exists":                               ReportSchedulerDuplicateName,
	"please fill the data require":                                                     ReportIncompleteData,
	"cannot edit the dashboard for existing report schedule":                           ReportDashboardEditNotAllowed,
	"report tenant details not found":                                                  ReportTenantDetailsNotFound,
	"bad request data while setting report branding settings":                          ReportBrandingSettingsBadRequest,
	"Invalid logo image. Only the following extensions are allowed: .png, .jpg, .jpeg": ReportInvalidLogoExtension,
	"Invalid image URL. Only the following extensions are allowed: .png, .jpg, .jpeg":  ReportInvalidImageURLExtension,
	"Invalid logo URL":                                                                 ReportInvalidLogoURL,
	"Invalid footer URL":                                                               ReportInvalidFooterURL,
	"bad request data while updating or creating tenant details":                       ReportTenantDetailsUpsertBadRequest,
	"Report is not in storage":                                                         ReportNotInStorage,
	"File is not available on storage":                                                 ReportFileNotAvailable,
	"Some recipients are not internal users":                                           ReportExternalRecipients,
	"report scheduler does not exist":                                                  ReportSchedulerNotFound,
	"report schedule limit exceeded":                                                   ReportScheduleLimitExceeded,
	"Failed to get previous FTP configuration":                                         ReportGetPreviousFTPConfigFailed,
	"bad request data while deleting report scheduler":                                 ReportSchedulerDeleteBadRequest,
	"bad request data while enabling report scheduler":                                 ReportSchedulerEnableBadRequest,
	"Some BCC recipients are not internal users":                                       ReportExternalBCCRecipients,
	"Some recipients are not in whitelist":                                             ReportRecipientsNotInWhitelist,
	"Some BCC recipients are not in whitelist":                                         ReportBCCNotInWhitelist,
	"Failed to fetch reports":                                                          ReportFetchFailed,
	"FTP Configuration already exist":                                                  FTPConfigAlreadyExists,
	"Failed to Add FTP Configuration":                                                  FTPConfigAddFailed,
	"Failed to Update FTP Configuration":                                               FTPConfigUpdateFailed,
	"bad request data while getting preview":                                           ReportPreviewBadRequest,
	"Default FTP configuration deletion is not allowed!":                               FTPDefaultDeletionNotAllowed,
	"FTP is used in report scheduler":                                                  FTPUsedInScheduler,
	"Failed to delete FTP configuration":                                               FTPConfigDeleteFailed,
	"Failed to delete report schedules for the org.":                                   ReportDeleteOrgFailed,
	"Failed to disable report schedules for the org.":                                  ReportDisableOrgFailed,
	"Failed to connect to FTP server":                                                  FTPConnectionFailed,
	"Report is successfully deleted":                                                   ReportsDeleteSuccess,
	"Successfully deleted user from reports.":                                          ReportUserDeleteSuccess,
	"Report branding is successfully updated.":                                         ReportBrandingUpdateSuccess,
	"Report branding is set to default.":                                               ReportBrandingDefaultSet,
	"Updated.":                                                                         ReportUpdated,
	"Deleted.":                                                                         ReportDeleted,
	"Reports owner updated successfully":                                               ReportOwnerUpdatedSuccess,

	"bad request data while updating signed in user":                            UsersUserUpdateBadRequest,
	"Not allowed to change email when auth proxy is using email property":       UsersAuthProxyEmailChangeNotAllowed,
	"Not allowed to change username when auth proxy is using username property": UsersAuthProxyUsernameChangeNotAllowed,
	"Invalid email address":                                     UsersInvalidEmailAddress,
	"Only users and service accounts can star dashboards":       UsersDashboardStarOnlyUsersAllowed,
	"Invalid dashboard UID":                                     UsersInvalidDashboardUID,
	"Only users and service accounts get starred dashboards":    UsersDashboardGetStarOnlyUsersAllowed,
	"bad request data while changing the password for the user": UsersChangePasswordBadRequest,
	"bad request data while revoking the auth token":            UsersRevokeTokenBadRequest,
	"bad request data while updating the user":                  UsersUserUpdateGeneralBadRequest,
	"Not a valid organization":                                  UsersInvalidOrganization,
	"entity not allowed to revoke tokens":                       UsersEntityNotAllowedToRevokeTokens,
	"entity not allowed to get tokens":                          UsersEntityNotAllowedToGetTokens,
	"Endpoint only available for users":                         UsersEndpointOnlyForUsers,
	"Update would result in user login conflict":                UsersUserLoginConflict,
	"Failed to get user":                                        UsersFailedToGetUser,
	"Failed to get user organizations":                          UsersFailedToGetUserOrganizations,
	"Failed to get user stars":                                  UsersFailedToGetUserStars,
	"Failed to fetch dashboards":                                UsersFailedToFetchDashboards,
	"Failed to star dashboard":                                  UsersFailedToStarDashboard,
	"Failed to unstar dashboard":                                UsersFailedToUnstarDashboard,
	"Failed to change user password":                            UsersFailedToChangePassword,
	"Failed to get org quotas":                                  UsersFailedToGetOrgQuotas,
	"Failed to update help flag":                                UsersFailedToUpdateHelpFlag,
	"Failed to generate email verification":                     UsersFailedToGenerateEmailVerification,
	"failed to parse user id":                                   UsersFailedToParseUserID,
	"Failed to get user teams":                                  UsersFailedToGetUserTeams,
	"Failed to update user":                                     UsersFailedToUpdateUser,
	"Active organization changed":                               UsersOrgChanged,
	"Dashboard starred!":                                        UsersDashboardStarred,
	"Dashboard unstarred":                                       UsersDashboardUnstarred,
	"User password changed":                                     UsersUserPasswordChanged,
	"User updated":                                              UsersUserUpdated,
	"Email sent for verification":                               UsersVerificationEmailSent,
	"user not found":                                            UsersUserNotFound,
	"User auth token not found":                                 UsersUserAuthTokenNotFound,
	"Failed to change active organization":                      UsersFailedToChangeActiveOrg,
	"Failed to revoke user auth token":                          UsersFailedToRevokeUserToken,
	"Failed to get user auth token":                             UsersFailedToGetUserToken,
	"Cannot revoke active user auth token":                      UsersCannotRevokeActiveToken,

	"bad request data while creating new user":                                           AdminUserCreateBadRequest,
	"bad request data while revoking auth token for user":                                AdminRevokeAuthTokenBadRequest,
	"bad request data while setting permissions for the user":                            AdminSetPermissionsBadRequest,
	"bad request data while setting password for user":                                   AdminSetPasswordBadRequest,
	"Password is missing or too short":                                                   AdminPasswordTooShort,
	"You cannot logout yourself":                                                         AdminCannotLogoutSelf,
	"cannot remove last grafana admin":                                                   AdminCannotRemoveLastAdmin,
	"Not allowed to reset password when login form is disabled":                          AdminPasswordResetNotAllowed,
	"Cannot change Grafana Admin role for externally synced user":                        AdminCannotChangeAdminRole,
	"Failed to authorize settings":                                                       AdminFailedToAuthorizeSettings,
	"User has conflicting login or email with another user. Please contact server admin": AdminLoginEmailConflict,
	"Failed to get admin stats from database":                                            AdminFailedToGetAdminStats,
	"Failed to get anon stats from database":                                             AdminFailedToGetAnonStats,
	"Failed to re-encrypt data keys":                                                     AdminFailedToReencryptKeys,
	"Failed to rotate data keys":                                                         AdminFailedToRotateKeys,
	"failed to create user":                                                              AdminFailedToCreate,
	"Could not read user from database":                                                  AdminFailedToReadFromDB,
	"Failed to update user password":                                                     AdminFailedToUpdatePassword,
	"Failed to update user permissions":                                                  AdminFailedToUpdatePermissions,
	"Failed to delete user":                                                              AdminFailedToDelete,
	"Could not disable external user":                                                    AdminFailedToDisableExternal,
	"Failed to disable user":                                                             AdminFailedToDisable,
	"Could not enable external user":                                                     AdminFailedToEnableExternal,
	"Failed to enable user":                                                              AdminFailedToEnable,
	"Failed to get user auth tokens":                                                     AdminFailedToGetAuthTokens,
	"Failed to logout user":                                                              AdminFailedToLogout,
	"User password updated but unable to revoke user sessions":                           AdminSessionsNotRevoked,
	"User password updated":                                                              AdminPasswordUpdated,
	"User permissions updated":                                                           AdminPermissionsUpdated,
	"User disabled":                                                                      AdminDisabled,
	"User enabled":                                                                       AdminEnabled,
	"Failed to re-encrypt secrets":                                                       AdminFailedToReencryptSecrets,
	"Failed to rollback secrets":                                                         AdminFailedToRollbackSecrets,
	"Failed to reload plugins config":                                                    AdminFailedToReloadPluginsConfig,
	"Dashboards config reloaded":                                                         AdminDashboardsConfigReloaded,
	"Plugins config reloaded":                                                            AdminPluginsConfigReloaded,
	"Datasources config reloaded":                                                        AdminDatasourcesConfigReloaded,
	"Alerting config reloaded":                                                           AdminAlertingConfigReloaded,

	"Maximum key limit exceeded": GlobalkeysLimitExceeded,
}
