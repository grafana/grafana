# GitHub & grafanabot automation

The bot is configured via [commands.json](https://github.com/grafana/grafana/blob/master/.github/commands.json) and some other GitHub workflows [workflows](https://github.com/grafana/grafana/tree/master/.github/workflows).

Comment commands:

* Write the word `/duplicate #<number>`  anywhere in a comment and the bot  will add the correct label and standard message.
* Write the word `/needsMoreInfo`  anywhere in a comment and the bot will add the correct label and standard message.

Label commands:

* Add label `bot/question` the the bot will close with standard question message and add label `type/question`
* Add label `bot/duplicate` the the bot will close with standard duplicate message and add label `type/duplicate`
* Add label `bot/needs more info` for bot to request more info (or use comment command mentioned above)
* Add label `bot/close feature request` for bot to close a feature request with standard message and adds label `not implemented`
* Add label `bot/no new info` for bot to close an issue where we asked for more info but has not received any updates in at least 14 days.

## Metrics

Metrics are configured in [metrics-collector.json](https://github.com/grafana/grafana/blob/master/.github/metrics-collector.json) and are also defined in the 
[metrics-collector](https://github.com/grafana/grafana-github-actions/blob/main/metrics-collector/index.ts) GitHub action.

## Backport PR

The backport logic is written [here](https://github.com/grafana/grafana-github-actions/blob/main/backport/backport.ts)
