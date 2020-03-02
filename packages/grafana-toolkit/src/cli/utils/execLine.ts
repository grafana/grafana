import { exec } from 'child_process';

const execLine = async (command: string): Promise<string> => {
  if (command.length > 0) {
    return exec(command)
      .toString()
      .replace(/\r?\n|\r/g, '')
      .replace(/^\s+/g, '')
      .replace(/\s+$/g, '');
  }
  return '';
};

export { execLine };
