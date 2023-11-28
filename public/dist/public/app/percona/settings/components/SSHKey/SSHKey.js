import { __awaiter } from "tslib";
import { cx } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import { Field, Form } from 'react-final-form';
import { Button, Spinner, TextArea, useStyles2 } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { Messages } from 'app/percona/settings/Settings.messages';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { updateSettingsAction } from 'app/percona/shared/core/reducers';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { SET_SETTINGS_CANCEL_TOKEN } from '../../Settings.constants';
import { getStyles } from './SSHKey.styles';
export const SSHKey = () => {
    const styles = useStyles2(getStyles);
    const settingsStyles = useStyles2(getSettingsStyles);
    const { ssh: { action, label, link, tooltip }, tooltipLinkText, } = Messages;
    const [loading, setLoading] = useState(false);
    const [generateToken] = useCancelToken();
    const { result: settings } = useSelector(getPerconaSettings);
    const dispatch = useAppDispatch();
    const navModel = usePerconaNavModel('settings-ssh');
    const { sshKey } = settings;
    const isEqual = (a, b) => (!a && !b) || a === b;
    const applyChanges = useCallback(({ key }) => __awaiter(void 0, void 0, void 0, function* () {
        setLoading(true);
        yield dispatch(updateSettingsAction({
            body: { ssh_key: key },
            token: generateToken(SET_SETTINGS_CANCEL_TOKEN),
        }));
        setLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    return (React.createElement(OldPage, { navModel: navModel, vertical: true, tabsDataTestId: "settings-tabs" },
        React.createElement(OldPage.Contents, { dataTestId: "settings-tab-content", className: settingsStyles.pageContent },
            React.createElement(FeatureLoader, null,
                React.createElement("div", { className: cx(settingsStyles.wrapper, styles.sshKeyWrapper) },
                    React.createElement(Form, { onSubmit: applyChanges, initialValues: { key: sshKey }, render: ({ handleSubmit, pristine }) => (React.createElement("form", { onSubmit: handleSubmit },
                            React.createElement("div", { className: settingsStyles.labelWrapper, "data-testid": "ssh-key-label" },
                                React.createElement("span", null, label),
                                React.createElement(LinkTooltip, { tooltipContent: tooltip, link: link, linkText: tooltipLinkText, icon: "info-circle" })),
                            React.createElement(Field, { name: "key", isEqual: isEqual, render: ({ input }) => React.createElement(TextArea, Object.assign({}, input, { className: styles.textarea, "data-testid": "ssh-key" })) }),
                            React.createElement(Button, { className: settingsStyles.actionButton, type: "submit", disabled: pristine || loading, "data-testid": "ssh-key-button" },
                                loading && React.createElement(Spinner, null),
                                action))) }))))));
};
export default SSHKey;
//# sourceMappingURL=SSHKey.js.map