import React, { useState } from 'react';
import { Redirect } from 'react-router-dom';
import KubernetesInventory from '../KubernetesInventory';
export const K8sRouting = () => {
    const [mode, setMode] = useState('list');
    return (React.createElement(React.Fragment, null,
        mode === 'register' && React.createElement(Redirect, { to: "/dbaas/kubernetes/registration" }),
        mode === 'list' && React.createElement(KubernetesInventory, { setMode: setMode })));
};
export default K8sRouting;
//# sourceMappingURL=K8sRouting.js.map