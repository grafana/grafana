import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { RefreshPicker } from '@grafana/ui';
import { changeRefreshInterval } from './state/time';
import { setPausedStateAction, runQueries } from './state/query';
/**
 * Hook that gives you all the functions needed to control the live tailing.
 */
export function useLiveTailControls(exploreId) {
    var dispatch = useDispatch();
    var pause = useCallback(function () {
        dispatch(setPausedStateAction({ exploreId: exploreId, isPaused: true }));
    }, [exploreId, dispatch]);
    var resume = useCallback(function () {
        dispatch(setPausedStateAction({ exploreId: exploreId, isPaused: false }));
    }, [exploreId, dispatch]);
    var stop = useCallback(function () {
        // We need to pause here first because there is transition where we are not live but live logs are still shown
        // to cross fade with the normal view. This will prevent reordering of the logs in the live view during the
        // transition.
        pause();
        // TODO referencing this from perspective of refresh picker when there is designated button for it now is not
        //  great. Needs a bit of refactoring.
        dispatch(changeRefreshInterval(exploreId, RefreshPicker.offOption.value));
        dispatch(runQueries(exploreId));
    }, [exploreId, dispatch, pause]);
    var start = useCallback(function () {
        dispatch(changeRefreshInterval(exploreId, RefreshPicker.liveOption.value));
    }, [exploreId, dispatch]);
    return {
        pause: pause,
        resume: resume,
        stop: stop,
        start: start,
    };
}
/**
 * If you can't use the hook you can use this as a render prop pattern.
 */
export function LiveTailControls(props) {
    var controls = useLiveTailControls(props.exploreId);
    return props.children(controls);
}
//# sourceMappingURL=useLiveTailControls.js.map