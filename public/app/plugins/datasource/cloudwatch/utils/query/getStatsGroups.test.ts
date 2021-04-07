import { getStatsGroups } from './getStatsGroups';

describe('GroupListener', () => {
  // https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax-examples.html
  // https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Container-Insights-view-metrics.html
  it('should correctly parse groups in stats query', () => {
    const testQueries = [
      {
        query:
          'filter @message like /Exception/ | stats count(*) as exceptionCount by bin(1h) | sort exceptionCount desc',
        expected: ['bin(1h)'],
      },
      {
        query: `filter @type = "REPORT"
      | stats max(@memorySize / 1024 / 1024) as provisonedMemoryMB,
          min(@maxMemoryUsed / 1024 / 1024) as smallestMemoryRequestMB,
          avg(@maxMemoryUsed / 1024 / 1024) as avgMemoryUsedMB,
          max(@maxMemoryUsed / 1024 / 1024) as maxMemoryUsedMB,
          provisonedMemoryMB - maxMemoryUsedMB as overProvisionedMB`,
        expected: [],
      },
      {
        query: `stats count(@message) by bin(1h), @log, @logStream as fieldAlias`,
        expected: ['bin(1h)', '@log', 'fieldAlias'],
      },

      {
        query: `stats sum(packets) as packetsTransferred by srcAddr, dstAddr
      | sort packetsTransferred  desc
      | limit 15`,
        expected: ['srcAddr', 'dstAddr'],
      },
      {
        query: `filter isIpv4InSubnet(srcAddr, "192.0.2.0/24")
      | stats sum(bytes) as bytesTransferred by dstAddr
      | sort bytesTransferred desc
      | limit 15`,
        expected: ['dstAddr'],
      },
      {
        query: `filter logStatus="SKIPDATA"
      | stats count(*) by bin(1h) as t
      | sort t
      `,
        expected: ['t'],
      },
      {
        query: `stats count(*) by queryType, bin(1h)`,
        expected: ['queryType', 'bin(1h)'],
      },
      {
        query: `parse @message "user=*, method:*, latency := *" as @user,
      @method, @latency | stats avg(@latency) by @method,
      @user`,
        expected: ['@method', '@user'],
      },
      {
        query: 'fields @timestamp, @message | sort @timestamp desc | limit 25',
        expected: [],
      },
      {
        query: `stats count(*)`,
        expected: [],
      },
      {
        query: `filter responseCode="SERVFAIL" | stats count(*) by queryName.0.1 as f0, bin(5m)`,
        expected: ['f0', 'bin(5m)'],
      },
      {
        query: `fields @timestamp, @message
      | filter @message like /dial tcp /
      | parse log /dial tcp (?<ip>[\d\.]+)\:(?<port>\d+)\: (?<reason>[^\\\"]+)/
      | stats count() by bin($__interval), reason`,
        expected: ['bin($__interval)', 'reason'],
      },
    ];

    for (const { query, expected } of testQueries) {
      expect(getStatsGroups(query)).toStrictEqual(expected);
    }
  });
});
