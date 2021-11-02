import { __values } from "tslib";
import { getStatsGroups } from './getStatsGroups';
describe('GroupListener', function () {
    // https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax-examples.html
    // https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Container-Insights-view-metrics.html
    it('should correctly parse groups in stats query', function () {
        var e_1, _a;
        var testQueries = [
            {
                query: 'filter @message like /Exception/ | stats count(*) as exceptionCount by bin(1h) | sort exceptionCount desc',
                expected: ['bin(1h)'],
            },
            {
                query: "filter @type = \"REPORT\"\n      | stats max(@memorySize / 1024 / 1024) as provisonedMemoryMB,\n          min(@maxMemoryUsed / 1024 / 1024) as smallestMemoryRequestMB,\n          avg(@maxMemoryUsed / 1024 / 1024) as avgMemoryUsedMB,\n          max(@maxMemoryUsed / 1024 / 1024) as maxMemoryUsedMB,\n          provisonedMemoryMB - maxMemoryUsedMB as overProvisionedMB",
                expected: [],
            },
            {
                query: "stats count(@message) by bin(1h), @log, @logStream as fieldAlias",
                expected: ['bin(1h)', '@log', 'fieldAlias'],
            },
            {
                query: "stats sum(packets) as packetsTransferred by srcAddr, dstAddr\n      | sort packetsTransferred  desc\n      | limit 15",
                expected: ['srcAddr', 'dstAddr'],
            },
            {
                query: "filter isIpv4InSubnet(srcAddr, \"192.0.2.0/24\")\n      | stats sum(bytes) as bytesTransferred by dstAddr\n      | sort bytesTransferred desc\n      | limit 15",
                expected: ['dstAddr'],
            },
            {
                query: "filter logStatus=\"SKIPDATA\"\n      | stats count(*) by bin(1h) as t\n      | sort t\n      ",
                expected: ['t'],
            },
            {
                query: "stats count(*) by queryType, bin(1h)",
                expected: ['queryType', 'bin(1h)'],
            },
            {
                query: "parse @message \"user=*, method:*, latency := *\" as @user,\n      @method, @latency | stats avg(@latency) by @method,\n      @user",
                expected: ['@method', '@user'],
            },
            {
                query: 'fields @timestamp, @message | sort @timestamp desc | limit 25',
                expected: [],
            },
            {
                query: "stats count(*)",
                expected: [],
            },
            {
                query: "filter responseCode=\"SERVFAIL\" | stats count(*) by queryName.0.1 as f0, bin(5m)",
                expected: ['f0', 'bin(5m)'],
            },
            {
                query: "fields @timestamp, @message\n      | filter @message like /dial tcp /\n      | parse log /dial tcp (?<ip>[d.]+):(?<port>d+): (?<reason>[^\\\"]+)/\n      | stats count() by bin($__interval), reason",
                expected: ['bin($__interval)', 'reason'],
            },
        ];
        try {
            for (var testQueries_1 = __values(testQueries), testQueries_1_1 = testQueries_1.next(); !testQueries_1_1.done; testQueries_1_1 = testQueries_1.next()) {
                var _b = testQueries_1_1.value, query = _b.query, expected = _b.expected;
                expect(getStatsGroups(query)).toStrictEqual(expected);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (testQueries_1_1 && !testQueries_1_1.done && (_a = testQueries_1.return)) _a.call(testQueries_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    });
});
//# sourceMappingURL=getStatsGroups.test.js.map