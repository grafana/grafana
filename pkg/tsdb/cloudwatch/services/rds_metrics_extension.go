package services

// RDS Performance Insights and Enhanced Monitoring metrics extension
// These metrics are available when Performance Insights and Enhanced Monitoring
// are enabled for RDS database instances.
//
// References:
// - Performance Insights: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PerfInsights.Cloudwatch.html
// - Enhanced Monitoring: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_Monitoring.OS.html

var rdsPerformanceInsightsMetrics = []string{
	// Performance Insights DB Load metrics
	"DBLoad",
	"DBLoadCPU",
	"DBLoadNonCPU",

	// Performance Insights wait event metrics
	"db.wait_event.name",
	"db.wait_event.type",

	// Performance Insights SQL metrics
	"db.sql.id",
	"db.sql.db_id",
	"db.sql.tokenized_id",

	// Performance Insights User metrics
	"db.user.id",
	"db.user.name",

	// Performance Insights Host metrics
	"db.host.id",
	"db.host.name",

	// Performance Insights Session Type metrics
	"db.session_type.name",

	// Performance Insights Database metrics
	"db.name",
}

var rdsEnhancedMonitoringMetrics = []string{
	// CPU metrics
	"cpuUtilization.guest",
	"cpuUtilization.idle",
	"cpuUtilization.irq",
	"cpuUtilization.nice",
	"cpuUtilization.steal",
	"cpuUtilization.system",
	"cpuUtilization.total",
	"cpuUtilization.user",
	"cpuUtilization.wait",

	// Memory metrics
	"memory.active",
	"memory.buffers",
	"memory.cached",
	"memory.dirty",
	"memory.free",
	"memory.hugePagesFree",
	"memory.hugePagesRsvd",
	"memory.hugePagesSize",
	"memory.hugePagesSurp",
	"memory.hugePagesTotal",
	"memory.inactive",
	"memory.mapped",
	"memory.pageTables",
	"memory.slab",
	"memory.total",
	"memory.writeback",

	// Swap metrics
	"swap.cached",
	"swap.free",
	"swap.total",

	// Disk I/O metrics
	"diskIO.avgQueueLen",
	"diskIO.avgReqSz",
	"diskIO.await",
	"diskIO.readIOsPS",
	"diskIO.readKb",
	"diskIO.readKbPS",
	"diskIO.rrqmPS",
	"diskIO.tps",
	"diskIO.util",
	"diskIO.writeIOsPS",
	"diskIO.writeKb",
	"diskIO.writeKbPS",
	"diskIO.wrqmPS",

	// File system metrics
	"fileSys.maxFiles",
	"fileSys.total",
	"fileSys.used",
	"fileSys.usedFilePercent",
	"fileSys.usedFiles",
	"fileSys.usedPercent",

	// Load average metrics
	"loadAverageMinute.fifteen",
	"loadAverageMinute.five",
	"loadAverageMinute.one",

	// Network metrics
	"network.rx",
	"network.tx",

	// Process metrics
	"processList.cpuUsedPc",
	"processList.id",
	"processList.memoryUsedPc",
	"processList.name",
	"processList.parentID",
	"processList.rss",
	"processList.tgid",
	"processList.vss",

	// Task metrics
	"tasks.blocked",
	"tasks.running",
	"tasks.sleeping",
	"tasks.stopped",
	"tasks.total",
	"tasks.zombie",
}

// GetExtendedRDSMetrics returns additional RDS metrics including Performance Insights
// and Enhanced Monitoring metrics that should be added to the AWS/RDS namespace
func GetExtendedRDSMetrics() []string {
	extended := make([]string, 0, len(rdsPerformanceInsightsMetrics)+len(rdsEnhancedMonitoringMetrics))
	extended = append(extended, rdsPerformanceInsightsMetrics...)
	extended = append(extended, rdsEnhancedMonitoringMetrics...)
	return extended
}
