import Plain from 'slate-plain-serializer';
import BracesPlugin from './braces';
describe('braces', function () {
    var handler = BracesPlugin().onKeyDown;
    it('adds closing braces around empty value', function () {
        var change = Plain.deserialize('').change();
        var event = new window.KeyboardEvent('keydown', { key: '(' });
        handler(event, change);
        expect(Plain.serialize(change.value)).toEqual('()');
    });
    it('adds closing braces around a value', function () {
        var change = Plain.deserialize('foo').change();
        var event = new window.KeyboardEvent('keydown', { key: '(' });
        handler(event, change);
        expect(Plain.serialize(change.value)).toEqual('(foo)');
    });
    it('adds closing braces around the following value only', function () {
        var change = Plain.deserialize('foo bar ugh').change();
        var event;
        event = new window.KeyboardEvent('keydown', { key: '(' });
        handler(event, change);
        expect(Plain.serialize(change.value)).toEqual('(foo) bar ugh');
        // Wrap bar
        change.move(5);
        event = new window.KeyboardEvent('keydown', { key: '(' });
        handler(event, change);
        expect(Plain.serialize(change.value)).toEqual('(foo) (bar) ugh');
        // Create empty parens after (bar)
        change.move(4);
        event = new window.KeyboardEvent('keydown', { key: '(' });
        handler(event, change);
        expect(Plain.serialize(change.value)).toEqual('(foo) (bar)() ugh');
    });
    it('adds closing braces outside a selector', function () {
        var change = Plain.deserialize('sumrate(metric{namespace="dev", cluster="c1"}[2m])').change();
        var event;
        change.move(3);
        event = new window.KeyboardEvent('keydown', { key: '(' });
        handler(event, change);
        expect(Plain.serialize(change.value)).toEqual('sum(rate(metric{namespace="dev", cluster="c1"}[2m]))');
    });
    it('removes closing brace when opening brace is removed', function () {
        var change = Plain.deserialize('time()').change();
        var event;
        change.move(5);
        event = new window.KeyboardEvent('keydown', { key: 'Backspace' });
        handler(event, change);
        expect(Plain.serialize(change.value)).toEqual('time');
    });
    it('keeps closing brace when opening brace is removed and inner values exist', function () {
        var change = Plain.deserialize('time(value)').change();
        var event;
        change.move(5);
        event = new window.KeyboardEvent('keydown', { key: 'Backspace' });
        var handled = handler(event, change);
        expect(handled).toBeFalsy();
    });
});
//# sourceMappingURL=braces.test.js.map