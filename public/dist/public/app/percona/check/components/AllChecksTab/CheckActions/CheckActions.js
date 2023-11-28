import { __awaiter } from "tslib";
import React, { useCallback, useState } from 'react';
import { IconButton, useStyles2 } from '@grafana/ui';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { Messages } from '../AllChecksTab.messages';
import { getStyles } from './CheckActions.styles';
export const CheckActions = ({ check, onChangeCheck, onIntervalChangeClick, onIndividualRunCheckClick, }) => {
    const styles = useStyles2(getStyles);
    const [runCheckPending, setRunCheckPending] = useState(false);
    const [intervalChangeLoading, setIntervalChangeLoading] = useState(false);
    const handleChangeCheck = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        setIntervalChangeLoading(true);
        yield onChangeCheck(check);
    }), [check, onChangeCheck]);
    const handleIntervalChangeClick = useCallback(() => onIntervalChangeClick(check), [check, onIntervalChangeClick]);
    const handleRunIndividualCheckClick = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        setRunCheckPending(true);
        yield onIndividualRunCheckClick(check);
        setRunCheckPending(false);
    }), [check, onIndividualRunCheckClick]);
    return (React.createElement("div", { className: styles.actionsWrapper },
        React.createElement(LoaderButton, { variant: "primary", disabled: !!check.disabled, size: "sm", loading: runCheckPending, onClick: handleRunIndividualCheckClick, "data-testid": "check-table-loader-button-run" }, Messages.run),
        React.createElement(LoaderButton, { variant: !!check.disabled ? 'primary' : 'destructive', size: "sm", loading: intervalChangeLoading, onClick: handleChangeCheck, "data-testid": "check-table-loader-button" }, !!check.disabled ? Messages.enable : Messages.disable),
        React.createElement(IconButton, { title: Messages.changeIntervalButtonTitle, "aria-label": Messages.changeIntervalButtonTitle, name: "pen", onClick: handleIntervalChangeClick })));
};
//# sourceMappingURL=CheckActions.js.map