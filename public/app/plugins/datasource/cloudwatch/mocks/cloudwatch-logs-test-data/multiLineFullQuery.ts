export const logsTestDataMultiLineFullQuery = {
  query: `fields @timestamp, unmask(@message) as msg, @memorySize
| filter (@message like /error/ and bytes > 1000) 
| parse @message /(?<NetworkInterface>eni-.*?)/
| stats count(NetworkInterface), max(@memorySize / 1000 / 1000) as provisonedMemoryMB by bin(1m)
# this is a comment with the next line left being intentionally blank

| limit 20`,
};
