import { css, cx } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Segment, useStyles2 } from '@grafana/ui';
import { actions } from '../state/actions';
import { useDispatch } from '../state/context';
import { mapFuncDefsToSelectables } from './helpers';
export function AddGraphiteFunction({ funcDefs }) {
    const dispatch = useDispatch();
    const [value, setValue] = useState(undefined);
    const styles = useStyles2(getStyles);
    const options = useMemo(() => mapFuncDefsToSelectables(funcDefs), [funcDefs]);
    // Note: actions.addFunction will add a component that will have a dropdown or input in auto-focus
    // (the first param of the function). This auto-focus will cause onBlur() on AddGraphiteFunction's
    // Segment component and trigger onChange once again. (why? we call onChange if the user dismissed
    // the dropdown, see: SegmentSelect.onCloseMenu for more details). To avoid it we need to wait for
    // the Segment to disappear first (hence useEffect) and then dispatch the action that will add new
    // components.
    useEffect(() => {
        if ((value === null || value === void 0 ? void 0 : value.value) !== undefined) {
            dispatch(actions.addFunction({ name: value.value }));
            setValue(undefined);
        }
    }, [value, dispatch]);
    return (React.createElement(Segment, { Component: React.createElement(Button, { icon: "plus", variant: "secondary", className: cx(styles.button), "aria-label": "Add new function" }), options: options, onChange: setValue, inputMinWidth: 150 }));
}
function getStyles(theme) {
    return {
        button: css `
      margin-right: ${theme.spacing(0.5)};
    `,
    };
}
//# sourceMappingURL=AddGraphiteFunction.js.map