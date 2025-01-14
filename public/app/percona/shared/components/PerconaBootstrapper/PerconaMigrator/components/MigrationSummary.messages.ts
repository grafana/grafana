export const Messages = {
  title: 'API migration status',
  description:
    'Migration of API keys complete. The following keys could not be converted to service accounts but remain fully functional:',
  failed: (failed: number, total: number) => `Failed conversions (${failed} of ${total} total)`,
  needHelp: 'Need help? See our ',
  documentation: 'documentation',
  or: ' or ',
  contactSupport: 'contact support',
  dot: '.',
  close: 'Close',
};
