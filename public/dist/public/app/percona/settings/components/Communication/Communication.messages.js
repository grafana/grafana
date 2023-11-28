// page is deprecated, so shortener is not needed
const COMMUNICATION_LINK = 'https://docs.percona.com/percona-monitoring-and-management/how-to/integrate-platform.html#communication';
export const Messages = {
    fields: {
        type: {
            label: 'Auth Type',
            tooltipText: 'Authentication type',
            tooltipLinkText: 'Read more',
            tooltipLink: COMMUNICATION_LINK,
        },
        from: {
            label: 'From',
            tooltipText: 'The sender address',
            tooltipLinkText: 'Read more',
            tooltipLink: COMMUNICATION_LINK,
        },
        smarthost: {
            label: 'Server Address',
            tooltipText: 'The default SMTP smarthost used for sending emails, including port number (e.g. smtp.example.org:587)',
            tooltipLinkText: 'Read more',
            tooltipLink: COMMUNICATION_LINK,
        },
        hello: {
            label: 'Hello',
            tooltipText: 'The hostname to identify the SMTP server',
            tooltipLinkText: 'Read more',
            tooltipLink: COMMUNICATION_LINK,
        },
        username: {
            label: 'Username',
            tooltipText: 'SMTP authentication information',
            tooltipLinkText: 'Read more',
            tooltipLink: COMMUNICATION_LINK,
        },
        password: {
            label: 'Password',
            tooltipText: 'SMTP authentication information',
            tooltipLinkText: 'Read more',
            tooltipLink: COMMUNICATION_LINK,
        },
        identity: {
            label: 'Identity',
            tooltipText: 'SMTP authentication information',
            tooltipLinkText: 'Read more',
            tooltipLink: COMMUNICATION_LINK,
        },
        slackURL: {
            label: 'URL',
            tooltipText: 'Slack incoming webhook URL',
            tooltipLinkText: 'Read more',
            tooltipLink: COMMUNICATION_LINK,
        },
    },
    actionButton: 'Apply changes',
    emailSent: 'Email sent',
    tabs: {
        slack: {
            key: 'slack',
            label: 'Slack',
        },
        email: {
            key: 'email',
            label: 'Email',
        },
    },
};
//# sourceMappingURL=Communication.messages.js.map