import { deprecationWarning } from './deprecationWarning';

test('It should not output deprecation warnings too often', () => {
  let dateNowValue = 10000000;

  const spyConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
  const spyDateNow = jest.spyOn(global.Date, 'now').mockImplementation(() => dateNowValue);
  // Make sure the mock works
  expect(Date.now()).toEqual(dateNowValue);
  expect(console.warn).toHaveBeenCalledTimes(0);

  // Call the deprecation many times
  deprecationWarning('file', 'oldName', 'newName');
  deprecationWarning('file', 'oldName', 'newName');
  deprecationWarning('file', 'oldName', 'newName');
  deprecationWarning('file', 'oldName', 'newName');
  deprecationWarning('file', 'oldName', 'newName');
  expect(console.warn).toHaveBeenCalledTimes(1);

  // Increment the time by 1min
  dateNowValue += 60000;
  deprecationWarning('file', 'oldName', 'newName');
  deprecationWarning('file', 'oldName', 'newName');
  expect(console.warn).toHaveBeenCalledTimes(2);

  deprecationWarning('file2', 'oldName', 'newName');
  deprecationWarning('file2', 'oldName', 'newName');
  deprecationWarning('file2', 'oldName', 'newName');
  expect(console.warn).toHaveBeenCalledTimes(3);

  // or restoreMocks automatically?
  spyConsoleWarn.mockRestore();
  spyDateNow.mockRestore();
});
