var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var Subscriber_1 = require('../Subscriber');
function inspect(notifier) {
    return this.lift(new InspectOperator(notifier));
}
exports.inspect = inspect;
var InspectOperator = (function () {
    function InspectOperator(notifier) {
        this.notifier = notifier;
    }
    InspectOperator.prototype.call = function (subscriber) {
        return new InspectSubscriber(subscriber, this.notifier);
    };
    return InspectOperator;
})();
var InspectSubscriber = (function (_super) {
    __extends(InspectSubscriber, _super);
    function InspectSubscriber(destination, notifier) {
        _super.call(this, destination);
        this.notifier = notifier;
        this.hasValue = false;
        this.add(notifier._subscribe(new SampleNotificationSubscriber(this)));
    }
    InspectSubscriber.prototype._next = function (value) {
        this.lastValue = value;
        this.hasValue = true;
    };
    InspectSubscriber.prototype.notifyNext = function () {
        if (this.hasValue) {
            this.destination.next(this.lastValue);
        }
    };
    return InspectSubscriber;
})(Subscriber_1.Subscriber);
var SampleNotificationSubscriber = (function (_super) {
    __extends(SampleNotificationSubscriber, _super);
    function SampleNotificationSubscriber(parent) {
        _super.call(this, null);
        this.parent = parent;
    }
    SampleNotificationSubscriber.prototype._next = function () {
        this.parent.notifyNext();
    };
    SampleNotificationSubscriber.prototype._error = function (err) {
        this.parent.error(err);
    };
    SampleNotificationSubscriber.prototype._complete = function () {
        //noop
    };
    return SampleNotificationSubscriber;
})(Subscriber_1.Subscriber);
//# sourceMappingURL=inspect.js.map