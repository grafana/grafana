+++
title = "Candlestick"
description = "Candlestick visualization documentation"
keywords = ["grafana", "Candlestick", "market", "financial", "panel", "documentation"]
aliases = ["/docs/grafana/latest/features/panels/candlestick/", "/docs/grafana/latest/panels/visualizations/candlestick/"]
weight = 200
+++

# Candlestick 

The Candlestick panel is a flexible visualization primarily, but not exclusively, for financial data. This visualization includes support for rendering mapped open, high, low, close

Highlights include:

* candlesticks, both solid and hollow variants
* OHLC bars
* customizeable up/down colors
* candle or bar color determined by either intra-period or inter-period price movement
* volume histogram with matched colors
* volume histogram can be detached into separate panel for flexible dashboarding, panel alignment and additional up/down color customization
* all fields that are not mapped for special rendering have full Time series styling and overrides available, including e.g. fillBelowTo for Bollinger bands construction.
* logarithmic scales and other features work the same as they do in the Time series panel