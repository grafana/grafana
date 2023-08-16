import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Dashboard templating',
  itName: 'Verify variable interpolation works',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    // Open dashboard global variables and interpolation
    e2e.flows.openDashboard({ uid: 'HYaGDGIMk' });

    const items: string[] = [];
    const expectedItems: string[] = [
      '__dashboard = Templating - Global variables and interpolation',
      '__dashboard.name = Templating - Global variables and interpolation',
      '__dashboard.uid = HYaGDGIMk',
      '__org.name = Main Org.',
      '__org.id = 1',
      '__user.id = 1',
      '__user.login = admin',
      '__user.email = admin@localhost',
      `Server:raw = A'A"A,BB\\B,CCC`,
      `Server:regex = (A'A"A|BB\\\\B|CCC)`,
      `Server:lucene = ("A'A\\"A" OR "BB\\\\B" OR "CCC")`,
      `Server:glob = {A'A"A,BB\\B,CCC}`,
      `Server:pipe = A'A"A|BB\\B|CCC`,
      `Server:distributed = A'A"A,Server=BB\\B,Server=CCC`,
      `Server:csv = A'A"A,BB\\B,CCC`,
      `Server:html = A&#39;A&quot;A, BB\\B, CCC`,
      `Server:json = ["A'A\\"A","BB\\\\B","CCC"]`,
      `Server:percentencode = %7BA%27A%22A%2CBB%5CB%2CCCC%7D`,
      `Server:singlequote = 'A\\'A"A','BB\\B','CCC'`,
      `Server:doublequote = "A'A\\"A","BB\\B","CCC"`,
      `Server:sqlstring = 'A''A"A','BB\\\B','CCC'`,
      `Server:date = NaN`,
      `Server:text = All`,
      `Server:queryparam = var-Server=All`,
      `1 < 2`,
      `Example: from=now-6h&to=now`,
    ];

    e2e()
      .get('.markdown-html li')
      .should('have.length', 26)
      .each((element) => {
        items.push(element.text());
      })
      .then(() => {
        expectedItems.forEach((expected, index) => {
          expect(items[index]).to.equal(expected);
        });
      });

    // Check link interpolation is working correctly
    e2e()
      .contains('a', 'Example: from=now-6h&to=now')
      .should('have.attr', 'href', 'https://example.com/?from=now-6h&to=now');
  },
});
