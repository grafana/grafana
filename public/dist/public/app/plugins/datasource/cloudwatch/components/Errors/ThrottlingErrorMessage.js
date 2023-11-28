import React from 'react';
export const ThrottlingErrorMessage = ({ region }) => (React.createElement("p", null,
    "Please visit the\u00A0",
    React.createElement("a", { target: "_blank", rel: "noreferrer", className: "text-link", href: `https://${region}.console.aws.amazon.com/servicequotas/home?region=${region}#!/services/monitoring/quotas/L-5E141212` }, "AWS Service Quotas console"),
    "\u00A0to request a quota increase or see our\u00A0",
    React.createElement("a", { target: "_blank", rel: "noreferrer", className: "text-link", href: "https://grafana.com/docs/grafana/latest/datasources/cloudwatch/#service-quotas" }, "documentation"),
    "\u00A0to learn more."));
//# sourceMappingURL=ThrottlingErrorMessage.js.map