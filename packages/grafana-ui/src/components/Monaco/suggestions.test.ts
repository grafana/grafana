import { findInsertIndex } from './suggestions';

describe('Check suggestion index', () => {
  it('find last $ sign', () => {
    const line = ' hello $123';
    const { index, prefix } = findInsertIndex(line);
    expect(index).toEqual(line.indexOf('$'));
    expect(prefix).toEqual('$123');
  });

  it('insert into empty line', () => {
    const line = '';
    const { index, prefix } = findInsertIndex(line);
    expect(index).toEqual(0);
    expect(prefix).toEqual('');
  });

  it('insert new word', () => {
    const line = 'this is a new ';
    const { index, prefix } = findInsertIndex(line);
    expect(index).toEqual(line.length);
    expect(prefix).toEqual('');
  });

  it('complte a simple word', () => {
    const line = 'SELECT * FROM tab';
    const { index, prefix } = findInsertIndex(line);
    expect(index).toEqual(line.lastIndexOf(' ') + 1);
    expect(prefix).toEqual('tab');
  });

  it('complete a quoted word', () => {
    const line = 'SELECT "hello", "wo';
    const { index, prefix } = findInsertIndex(line);
    expect(index).toEqual(line.lastIndexOf('"') + 1);
    expect(prefix).toEqual('wo');
  });
});
