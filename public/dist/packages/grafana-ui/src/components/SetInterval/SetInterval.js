import { __extends } from "tslib";
import { PureComponent } from 'react';
import { interval, Subject, of, NEVER } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { isEqual } from 'lodash';
import { stringToMs } from '@grafana/data';
import { RefreshPicker } from '../RefreshPicker/RefreshPicker';
export function getIntervalFromString(strInterval) {
    return {
        label: strInterval,
        value: stringToMs(strInterval),
    };
}
var SetInterval = /** @class */ (function (_super) {
    __extends(SetInterval, _super);
    function SetInterval(props) {
        var _this = _super.call(this, props) || this;
        _this.propsSubject = new Subject();
        _this.subscription = null;
        return _this;
    }
    SetInterval.prototype.componentDidMount = function () {
        var _this = this;
        // Creating a subscription to propsSubject. This subject pushes values every time
        // SetInterval's props change
        this.subscription = this.propsSubject
            .pipe(
        // switchMap creates a new observables based on the input stream,
        // which becomes part of the propsSubject stream
        switchMap(function (props) {
            // If the query is live, empty value is emitted. `of` creates single value,
            // which is merged to propsSubject stream
            if (RefreshPicker.isLive(props.interval)) {
                return of({});
            }
            // When query is loading, a new stream is merged. But it's a stream that emits no values(NEVER),
            // hence next call of this function will happen when query changes, and new props are passed into this component
            // When query is NOT loading, a new value is emitted, this time it's an interval value,
            // which makes tap function below execute on that interval basis.
            return props.loading ? NEVER : interval(stringToMs(props.interval));
        }), 
        // tap will execute function passed via func prop
        // * on value from `of` stream merged if query is live
        // * on specified interval (triggered by values emitted by interval)
        tap(function () { return _this.props.func(); }))
            .subscribe();
        // When component has mounted, propsSubject emits it's first value
        this.propsSubject.next(this.props);
    };
    SetInterval.prototype.componentDidUpdate = function (prevProps) {
        if ((RefreshPicker.isLive(prevProps.interval) && RefreshPicker.isLive(this.props.interval)) ||
            isEqual(prevProps, this.props)) {
            return;
        }
        // if props changed, a new value is emitted from propsSubject
        this.propsSubject.next(this.props);
    };
    SetInterval.prototype.componentWillUnmount = function () {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        this.propsSubject.unsubscribe();
    };
    SetInterval.prototype.render = function () {
        return null;
    };
    return SetInterval;
}(PureComponent));
export { SetInterval };
//# sourceMappingURL=SetInterval.js.map