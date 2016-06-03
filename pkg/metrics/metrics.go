package metrics

var MetricStats Registry
var UseNilMetrics bool

func init() {
	// init with nil metrics
	initMetricVars(&MetricSettings{})
}

var (
	M_Instance_Start                  Counter
	M_Page_Status_200                 Counter
	M_Page_Status_500                 Counter
	M_Page_Status_404                 Counter
	M_Api_Status_500                  Counter
	M_Api_Status_404                  Counter
	M_Api_User_SignUpStarted          Counter
	M_Api_User_SignUpCompleted        Counter
	M_Api_User_SignUpInvite           Counter
	M_Api_Dashboard_Save              Timer
	M_Api_Dashboard_Get               Timer
	M_Api_Dashboard_Search            Timer
	M_Api_Admin_User_Create           Counter
	M_Api_Login_Post                  Counter
	M_Api_Login_OAuth                 Counter
	M_Api_Org_Create                  Counter
	M_Api_Dashboard_Snapshot_Create   Counter
	M_Api_Dashboard_Snapshot_External Counter
	M_Api_Dashboard_Snapshot_Get      Counter
	M_Models_Dashboard_Insert         Counter

	// Timers
	M_DataSource_ProxyReq_Timer Timer
)

func initMetricVars(settings *MetricSettings) {
	UseNilMetrics = settings.Enabled == false
	MetricStats = NewRegistry()

	M_Instance_Start = RegCounter("instance_start")

	M_Page_Status_200 = RegCounter("page.resp_status", "code", "200")
	M_Page_Status_500 = RegCounter("page.resp_status", "code", "500")
	M_Page_Status_404 = RegCounter("page.resp_status", "code", "404")

	M_Api_Status_500 = RegCounter("api.resp_status", "code", "500")
	M_Api_Status_404 = RegCounter("api.resp_status", "code", "404")

	M_Api_User_SignUpStarted = RegCounter("api.user.signup_started")
	M_Api_User_SignUpCompleted = RegCounter("api.user.signup_completed")
	M_Api_User_SignUpInvite = RegCounter("api.user.signup_invite")

	M_Api_Dashboard_Save = RegTimer("api.dashboard.save")
	M_Api_Dashboard_Get = RegTimer("api.dashboard.get")
	M_Api_Dashboard_Search = RegTimer("api.dashboard.search")

	M_Api_Admin_User_Create = RegCounter("api.admin.user_create")
	M_Api_Login_Post = RegCounter("api.login.post")
	M_Api_Login_OAuth = RegCounter("api.login.oauth")
	M_Api_Org_Create = RegCounter("api.org.create")

	M_Api_Dashboard_Snapshot_Create = RegCounter("api.dashboard_snapshot.create")
	M_Api_Dashboard_Snapshot_External = RegCounter("api.dashboard_snapshot.external")
	M_Api_Dashboard_Snapshot_Get = RegCounter("api.dashboard_snapshot.get")

	M_Models_Dashboard_Insert = RegCounter("models.dashboard.insert")

	// Timers
	M_DataSource_ProxyReq_Timer = RegTimer("api.dataproxy.request.all")
}
