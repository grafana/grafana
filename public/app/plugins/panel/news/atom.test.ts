import fs from 'fs';

import { parseAtomFeed } from './atom';

describe('Atom feed parser', () => {
  it('should successfully parse an atom feed', async () => {
    const atomFile = fs.readFileSync(`${__dirname}/fixtures/atom.xml`, 'utf8');
    const parsedFeed = parseAtomFeed(atomFile);
    expect(parsedFeed.items).toHaveLength(1);
    expect(parsedFeed.items[0].title).toBe('Why Testing Is The Best');
    expect(parsedFeed.items[0].link).toBe('https://www.example.com/2022/02/12/why-testing-is-the-best/');
    expect(parsedFeed.items[0].pubDate).toBe('2022-02-12T08:00:00+00:00');
    expect(parsedFeed.items[0].content).toMatch(
      /Testing is the best because it lets you know your code isn't broken, probably./
    );
  });
});
