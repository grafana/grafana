import Plain from 'slate-plain-serializer';
import ClearPlugin from './clear';
describe('clear', function () {
    var handler = ClearPlugin().onKeyDown;
    it('does not change the empty value', function () {
        var change = Plain.deserialize('').change();
        var event = new window.KeyboardEvent('keydown', {
            key: 'k',
            ctrlKey: true,
        });
        handler(event, change);
        expect(Plain.serialize(change.value)).toEqual('');
    });
    it('clears to the end of the line', function () {
        var change = Plain.deserialize('foo').change();
        var event = new window.KeyboardEvent('keydown', {
            key: 'k',
            ctrlKey: true,
        });
        handler(event, change);
        expect(Plain.serialize(change.value)).toEqual('');
    });
    it('clears from the middle to the end of the line', function () {
        var change = Plain.deserialize('foo bar').change();
        change.move(4);
        var event = new window.KeyboardEvent('keydown', {
            key: 'k',
            ctrlKey: true,
        });
        handler(event, change);
        expect(Plain.serialize(change.value)).toEqual('foo ');
    });
});
//# sourceMappingURL=clear.test.js.map