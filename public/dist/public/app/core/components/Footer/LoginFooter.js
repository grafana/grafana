/* eslint-disable react/display-name */
import React from 'react';
const FOOTER_LINKS = [
    {
        text: 'Grafana',
        url: 'https://grafana.com/grafana',
        target: '_blank',
    },
    {
        text: 'Prometheus',
        url: 'https://prometheus.io',
        target: '_blank',
    },
    {
        text: 'Clickhouse',
        url: 'https://clickhouse.tech',
        target: '_blank',
    },
    {
        text: 'PostgreSQL',
        url: 'https://www.postgresql.org',
        target: '_blank',
    },
];
const LoginFooter = React.memo(() => {
    return (React.createElement("footer", { className: "footer" },
        React.createElement("div", { className: "text-center" },
            React.createElement("div", null, "Percona Monitoring and Management proudly powered by open source projects"),
            React.createElement("ul", null, FOOTER_LINKS.map((link) => (React.createElement("li", { key: link.text },
                React.createElement("a", { href: link.url, target: link.target, rel: "noopener noreferrer" }, link.text)))).concat(React.createElement("li", null, "and more"))))));
});
LoginFooter.displayName = 'LoginFooter';
export default LoginFooter;
//# sourceMappingURL=LoginFooter.js.map