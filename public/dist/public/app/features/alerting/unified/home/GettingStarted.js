import { css, cx } from '@emotion/css';
import React from 'react';
import SVG from 'react-inlinesvg';
import { Stack } from '@grafana/experimental';
import { EmbeddedScene, SceneFlexLayout, SceneFlexItem, SceneReactObject } from '@grafana/scenes';
import { Icon, useStyles2, useTheme2 } from '@grafana/ui';
export const getOverviewScene = () => {
    return new EmbeddedScene({
        body: new SceneFlexLayout({
            children: [
                new SceneFlexItem({
                    body: new SceneReactObject({
                        component: GettingStarted,
                    }),
                }),
            ],
        }),
    });
};
export default function GettingStarted({ showWelcomeHeader }) {
    const theme = useTheme2();
    const styles = useStyles2(getWelcomePageStyles);
    return (React.createElement("div", { className: styles.grid },
        showWelcomeHeader && React.createElement(WelcomeHeader, { className: styles.ctaContainer }),
        React.createElement(ContentBox, { className: styles.flowBlock },
            React.createElement("div", null,
                React.createElement("h3", null, "How it works"),
                React.createElement("ul", { className: styles.list },
                    React.createElement("li", null, "Grafana alerting periodically queries data sources and evaluates the condition defined in the alert rule"),
                    React.createElement("li", null, "If the condition is breached, an alert instance fires"),
                    React.createElement("li", null, "Firing instances are routed to notification policies based on matching labels"),
                    React.createElement("li", null, "Notifications are sent out to the contact points specified in the notification policy"))),
            React.createElement(SVG, { src: `public/img/alerting/at_a_glance_${theme.name.toLowerCase()}.svg`, width: undefined, height: undefined })),
        React.createElement(ContentBox, { className: styles.gettingStartedBlock },
            React.createElement("h3", null, "Get started"),
            React.createElement(Stack, { direction: "column", alignItems: "space-between" },
                React.createElement("ul", { className: styles.list },
                    React.createElement("li", null,
                        React.createElement("strong", null, "Create an alert rule"),
                        " by adding queries and expressions from multiple data sources."),
                    React.createElement("li", null,
                        React.createElement("strong", null, "Add labels"),
                        " to your alert rules ",
                        React.createElement("strong", null, "to connect them to notification policies")),
                    React.createElement("li", null,
                        React.createElement("strong", null, "Configure contact points"),
                        " to define where to send your notifications to."),
                    React.createElement("li", null,
                        React.createElement("strong", null, "Configure notification policies"),
                        " to route your alert instances to contact points.")),
                React.createElement("div", null,
                    React.createElement(ArrowLink, { href: "https://grafana.com/docs/grafana/latest/alerting/", title: "Read more in the Docs" })))),
        React.createElement(ContentBox, { className: styles.videoBlock },
            React.createElement("iframe", { title: "Alerting - Introductory video", src: "https://player.vimeo.com/video/720001629?h=c6c1732f92", width: "960", height: "540", allow: "autoplay; fullscreen", allowFullScreen: true, frameBorder: "0", 
                // This is necessary because color-scheme defined on :root has impact on iframe elements
                // More about how color-scheme works for iframes https://github.com/w3c/csswg-drafts/issues/4772
                // Summary: If the color scheme of an iframe differs from embedding document iframe gets an opaque canvas bg appropriate to its color scheme
                style: { colorScheme: 'light dark' } }))));
}
const getWelcomePageStyles = (theme) => ({
    grid: css `
    display: grid;
    grid-template-rows: min-content auto auto;
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
    gap: ${theme.spacing(2)};
  `,
    ctaContainer: css `
    grid-column: 1 / span 5;
  `,
    flowBlock: css `
    grid-column: 1 / span 5;

    display: flex;
    flex-wrap: wrap;
    gap: ${theme.spacing(1)};

    & > div {
      flex: 2;
      min-width: 350px;
    }
    & > svg {
      flex: 3;
      min-width: 500px;
    }
  `,
    videoBlock: css `
    grid-column: 3 / span 3;

    // Video required
    position: relative;
    padding: 56.25% 0 0 0; /* 16:9 */

    iframe {
      position: absolute;
      top: ${theme.spacing(2)};
      left: ${theme.spacing(2)};
      width: calc(100% - ${theme.spacing(4)});
      height: calc(100% - ${theme.spacing(4)});
      border: none;
    }
  `,
    gettingStartedBlock: css `
    grid-column: 1 / span 2;
    justify-content: space-between;
  `,
    list: css `
    margin: ${theme.spacing(0, 2)};
    & > li {
      margin-bottom: ${theme.spacing(1)};
    }
  `,
});
export function WelcomeHeader({ className }) {
    const styles = useStyles2(getWelcomeHeaderStyles);
    return (React.createElement("div", { className: styles.welcomeHeaderWrapper },
        React.createElement("div", { className: styles.subtitle }, "Learn about problems in your systems moments after they occur"),
        React.createElement(ContentBox, { className: cx(styles.ctaContainer, className) },
            React.createElement(WelcomeCTABox, { title: "Alert rules", description: "Define the condition that must be met before an alert rule fires", href: "/alerting/list", hrefText: "Manage alert rules" }),
            React.createElement("div", { className: styles.separator }),
            React.createElement(WelcomeCTABox, { title: "Contact points", description: "Configure who receives notifications and how they are sent", href: "/alerting/notifications", hrefText: "Manage contact points" }),
            React.createElement("div", { className: styles.separator }),
            React.createElement(WelcomeCTABox, { title: "Notification policies", description: "Configure how firing alert instances are routed to contact points", href: "/alerting/routes", hrefText: "Manage notification policies" }))));
}
const getWelcomeHeaderStyles = (theme) => ({
    welcomeHeaderWrapper: css({
        color: theme.colors.text.primary,
    }),
    subtitle: css({
        color: theme.colors.text.secondary,
        paddingBottom: theme.spacing(2),
    }),
    ctaContainer: css `
    padding: ${theme.spacing(4, 2)};
    display: flex;
    gap: ${theme.spacing(4)};
    justify-content: space-between;
    flex-wrap: wrap;

    ${theme.breakpoints.down('lg')} {
      flex-direction: column;
    }
  `,
    separator: css `
    width: 1px;
    background-color: ${theme.colors.border.medium};

    ${theme.breakpoints.down('lg')} {
      display: none;
    }
  `,
});
function WelcomeCTABox({ title, description, href, hrefText }) {
    const styles = useStyles2(getWelcomeCTAButtonStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement("h3", { className: styles.title }, title),
        React.createElement("div", { className: styles.desc }, description),
        React.createElement("div", { className: styles.actionRow },
            React.createElement("a", { href: href, className: styles.link }, hrefText))));
}
const getWelcomeCTAButtonStyles = (theme) => ({
    container: css `
    flex: 1;
    min-width: 240px;
    display: grid;
    gap: ${theme.spacing(1)};
    grid-template-columns: min-content 1fr 1fr 1fr;
    grid-template-rows: min-content auto min-content;
  `,
    title: css `
    margin-bottom: 0;
    grid-column: 2 / span 3;
    grid-row: 1;
  `,
    desc: css `
    grid-column: 2 / span 3;
    grid-row: 2;
  `,
    actionRow: css `
    grid-column: 2 / span 3;
    grid-row: 3;
    max-width: 240px;
  `,
    link: css `
    color: ${theme.colors.text.link};
  `,
});
function ContentBox({ children, className }) {
    const styles = useStyles2(getContentBoxStyles);
    return React.createElement("div", { className: cx(styles.box, className) }, children);
}
const getContentBoxStyles = (theme) => ({
    box: css `
    padding: ${theme.spacing(2)};
    background-color: ${theme.colors.background.secondary};
    border-radius: ${theme.shape.radius.default};
  `,
});
function ArrowLink({ href, title }) {
    const styles = useStyles2(getArrowLinkStyles);
    return (React.createElement("a", { href: href, className: styles.link, rel: "noreferrer" },
        title,
        " ",
        React.createElement(Icon, { name: "angle-right", size: "xl" })));
}
const getArrowLinkStyles = (theme) => ({
    link: css `
    display: block;
    color: ${theme.colors.text.link};
  `,
});
//# sourceMappingURL=GettingStarted.js.map