import React, { useCallback } from 'react';
import { Button } from '@grafana/ui';
import { actions } from '../state/actions';
import { useDispatch } from '../state/context';
export function PlayButton() {
    var dispatch = useDispatch();
    var onClick = useCallback(function () {
        dispatch(actions.unpause());
    }, [dispatch]);
    return React.createElement(Button, { icon: "play", onClick: onClick, type: "button", variant: "secondary" });
}
//# sourceMappingURL=PlayButton.js.map