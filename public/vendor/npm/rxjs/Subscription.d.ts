export declare class Subscription<T> {
    static EMPTY: Subscription<void>;
    isUnsubscribed: boolean;
    _subscriptions: Subscription<any>[];
    _unsubscribe(): void;
    constructor(_unsubscribe?: () => void);
    unsubscribe(): void;
    add(subscription: Subscription<any> | Function | void): void;
    remove(subscription: Subscription<any>): void;
}
